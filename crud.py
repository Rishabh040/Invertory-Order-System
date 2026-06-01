from sqlalchemy.orm import Session
from sqlalchemy import or_, func
from app import models, schemas
from fastapi import HTTPException, status

# --- Product CRUD ---

def get_product(db: Session, product_id: int):
    return db.query(models.Product).filter(models.Product.id == product_id).first()

def get_product_by_sku(db: Session, sku: str):
    return db.query(models.Product).filter(models.Product.sku == sku).first()

def get_products(db: Session, skip: int = 0, limit: int = 100, search: str = None):
    query = db.query(models.Product)
    if search:
        query = query.filter(
            or_(
                models.Product.name.ilike(f"%{search}%"),
                models.Product.sku.ilike(f"%{search}%"),
                models.Product.description.ilike(f"%{search}%")
            )
        )
    return query.offset(skip).limit(limit).all()

def create_product(db: Session, product: schemas.ProductCreate):
    # Check uniqueness of SKU
    db_product = get_product_by_sku(db, sku=product.sku)
    if db_product:
        raise ValueError(f"Product with SKU '{product.sku}' already exists.")
    
    db_product = models.Product(**product.model_dump())
    db.add(db_product)
    db.commit()
    db.refresh(db_product)
    return db_product

def update_product(db: Session, product_id: int, product_update: schemas.ProductUpdate):
    db_product = get_product(db, product_id)
    if not db_product:
        return None
    
    update_data = product_update.model_dump(exclude_unset=True)
    
    if "sku" in update_data and update_data["sku"] != db_product.sku:
        # Check SKU uniqueness
        sku_exists = get_product_by_sku(db, sku=update_data["sku"])
        if sku_exists:
            raise ValueError(f"Product with SKU '{update_data['sku']}' already exists.")
            
    for key, value in update_data.items():
        setattr(db_product, key, value)
        
    db.commit()
    db.refresh(db_product)
    return db_product

def delete_product(db: Session, product_id: int):
    db_product = get_product(db, product_id)
    if not db_product:
        return None
    db.delete(db_product)
    db.commit()
    return db_product


# --- Customer CRUD ---

def get_customer(db: Session, customer_id: int):
    return db.query(models.Customer).filter(models.Customer.id == customer_id).first()

def get_customer_by_email(db: Session, email: str):
    return db.query(models.Customer).filter(models.Customer.email == email).first()

def get_customers(db: Session, skip: int = 0, limit: int = 100, search: str = None):
    query = db.query(models.Customer)
    if search:
        query = query.filter(
            or_(
                models.Customer.name.ilike(f"%{search}%"),
                models.Customer.email.ilike(f"%{search}%")
            )
        )
    return query.offset(skip).limit(limit).all()

def create_customer(db: Session, customer: schemas.CustomerCreate):
    # Check uniqueness of email
    db_customer = get_customer_by_email(db, email=customer.email)
    if db_customer:
        raise ValueError(f"Customer with email '{customer.email}' already exists.")
    
    db_customer = models.Customer(**customer.model_dump())
    db.add(db_customer)
    db.commit()
    db.refresh(db_customer)
    return db_customer

def update_customer(db: Session, customer_id: int, customer_update: schemas.CustomerUpdate):
    db_customer = get_customer(db, customer_id)
    if not db_customer:
        return None
        
    update_data = customer_update.model_dump(exclude_unset=True)
    if "email" in update_data and update_data["email"] != db_customer.email:
        email_exists = get_customer_by_email(db, email=update_data["email"])
        if email_exists:
            raise ValueError(f"Customer with email '{update_data['email']}' already exists.")
            
    for key, value in update_data.items():
        setattr(db_customer, key, value)
        
    db.commit()
    db.refresh(db_customer)
    return db_customer

def delete_customer(db: Session, customer_id: int):
    db_customer = get_customer(db, customer_id)
    if not db_customer:
        return None
    db.delete(db_customer)
    db.commit()
    return db_customer


# --- Order CRUD ---

def get_order(db: Session, order_id: int):
    return db.query(models.Order).filter(models.Order.id == order_id).first()

def get_orders(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Order).order_by(models.Order.created_at.desc()).offset(skip).limit(limit).all()

def create_order(db: Session, order_data: schemas.OrderCreate):
    # Start transaction (managed by session)
    # Check customer
    customer = get_customer(db, order_data.customer_id)
    if not customer:
        raise ValueError("Customer not found.")
        
    # Get product IDs
    product_ids = [item.product_id for item in order_data.items]
    
    # Avoid duplicate product IDs in request causing multiple locks/unexpected behavior
    if len(product_ids) != len(set(product_ids)):
        raise ValueError("Duplicate products in the order list are not allowed. Combine quantities instead.")

    # Select products FOR UPDATE to prevent race conditions in concurrent stock reduction
    products = db.query(models.Product).filter(
        models.Product.id.in_(product_ids)
    ).with_for_update().all()
    
    # Verify all products exist
    product_map = {p.id: p for p in products}
    if len(product_map) != len(product_ids):
        missing_ids = set(product_ids) - set(product_map.keys())
        raise ValueError(f"One or more products not found: IDs {list(missing_ids)}")
        
    # Verify stock levels and reduce inventory
    total_price = 0.0
    order_items = []
    
    for item in order_data.items:
        product = product_map[item.product_id]
        
        if product.stock < item.quantity:
            raise ValueError(
                f"Insufficient stock for product '{product.name}' (SKU: {product.sku}). "
                f"Requested: {item.quantity}, Available: {product.stock}"
            )
            
        # Deduct stock
        product.stock -= item.quantity
        
        # Calculate item cost
        item_cost = product.price * item.quantity
        total_price += item_cost
        
        # Create OrderItem object
        db_item = models.OrderItem(
            product_id=product.id,
            quantity=item.quantity,
            unit_price=product.price
        )
        order_items.append(db_item)
        
    # Create the Order
    db_order = models.Order(
        customer_id=order_data.customer_id,
        total_price=total_price,
        status="Completed" # Initial status is completed since stock is deducted
    )
    
    db.add(db_order)
    db.flush() # Generate db_order.id
    
    # Link order items to order
    for db_item in order_items:
        db_item.order_id = db_order.id
        db.add(db_item)
        
    db.commit()
    db.refresh(db_order)
    return db_order

def cancel_order(db: Session, order_id: int):
    # Get the order
    db_order = get_order(db, order_id)
    if not db_order:
        return None
        
    if db_order.status == "Cancelled":
        raise ValueError("Order is already cancelled.")
        
    # Lock products of this order to restore stock
    product_ids = [item.product_id for item in db_order.items]
    products = db.query(models.Product).filter(
        models.Product.id.in_(product_ids)
    ).with_for_update().all()
    
    product_map = {p.id: p for p in products}
    
    for item in db_order.items:
        if item.product_id in product_map:
            product_map[item.product_id].stock += item.quantity
            
    db_order.status = "Cancelled"
    db.commit()
    db.refresh(db_order)
    return db_order

def update_order_status(db: Session, order_id: int, status: str):
    db_order = get_order(db, order_id)
    if not db_order:
        return None
        
    old_status = db_order.status
    if old_status == status:
        return db_order
        
    if status == "Cancelled":
        return cancel_order(db, order_id)
        
    if old_status == "Cancelled" and status in ["Completed", "Pending"]:
        # We need to deduct stock again if transitioning from Cancelled back to Active
        product_ids = [item.product_id for item in db_order.items]
        products = db.query(models.Product).filter(
            models.Product.id.in_(product_ids)
        ).with_for_update().all()
        
        product_map = {p.id: p for p in products}
        
        # Verify stock levels
        for item in db_order.items:
            product = product_map.get(item.product_id)
            if not product:
                raise ValueError(f"Product ID {item.product_id} no longer exists.")
            if product.stock < item.quantity:
                raise ValueError(
                    f"Insufficient stock to reinstate order. "
                    f"Product '{product.name}' needs {item.quantity}, only {product.stock} available."
                )
                
        # Deduct stock
        for item in db_order.items:
            product_map[item.product_id].stock -= item.quantity
            
    db_order.status = status
    db.commit()
    db.refresh(db_order)
    return db_order


# --- Dashboard Stats ---

def get_dashboard_stats(db: Session):
    total_products = db.query(models.Product).count()
    total_customers = db.query(models.Customer).count()
    total_orders = db.query(models.Order).count()
    
    # Low stock is defined as stock <= 5
    low_stock_count = db.query(models.Product).filter(models.Product.stock <= 5).count()
    
    # Total revenue from Completed orders
    total_sales = db.query(func.sum(models.Order.total_price)).filter(
        models.Order.status != "Cancelled"
    ).scalar() or 0.0
    
    # Top 5 recent orders
    recent_orders = db.query(models.Order).order_by(models.Order.created_at.desc()).limit(5).all()
    
    return {
        "total_products": total_products,
        "total_customers": total_customers,
        "total_orders": total_orders,
        "low_stock_count": low_stock_count,
        "total_sales": float(total_sales),
        "recent_orders": recent_orders
    }
