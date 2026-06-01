from fastapi import FastAPI, Depends, HTTPException, status, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List, Optional
import time

from app import models, schemas, crud, config
from app.database import engine, Base, get_db

# Wait a short delay if in docker container to let postgres boot, 
# although compose healthcheck handles this, it's a good safety check.
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title=config.settings.PROJECT_NAME,
    version="1.0.0",
)

# CORS middleware configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In development, allow all. In production, configure specifically.
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Seeding script on startup
@app.on_event("startup")
def seed_data():
    db = next(get_db())
    try:
        # Check if database is empty
        product_count = db.query(models.Product).count()
        customer_count = db.query(models.Customer).count()
        
        if product_count == 0 and customer_count == 0:
            print("Database is empty. Seeding initial test data...")
            # 1. Add products
            products_seed = [
                models.Product(sku="APL-128-IPH", name="iPhone 15 Pro Max 128GB", description="Apple flagship smartphone with A17 Pro chip and titanium body", price=1099.99, stock=10),
                models.Product(sku="APL-256-IPH", name="iPhone 15 Pro Max 256GB", description="Apple flagship smartphone with A17 Pro chip and titanium body", price=1199.99, stock=4),
                models.Product(sku="MAC-M3-16", name="MacBook Pro M3 Pro 16GB", description="Apple laptop with 14-inch Liquid Retina XDR display, M3 Pro chip", price=1999.99, stock=15),
                models.Product(sku="MAC-M3-8", name="MacBook Air M3 8GB", description="Superlight laptop with M3 chip, 13.6-inch Liquid Retina display", price=1099.99, stock=3),
                models.Product(sku="SAM-S24-ULT", name="Samsung Galaxy S24 Ultra", description="Samsung flagship phone with S Pen, Snapdragon 8 Gen 3", price=1299.99, stock=12),
                models.Product(sku="LOG-MX3-MST", name="Logitech MX Master 3S", description="Performance wireless ergonomic mouse with silent clicks", price=99.99, stock=50),
                models.Product(sku="LOG-K860-ERG", name="Logitech Ergo K860 Keyboard", description="Split ergonomic wireless keyboard with pillowed wrist rest", price=129.99, stock=0),
                models.Product(sku="SONY-WH1000-M5", name="Sony WH-1000XM5", description="Wireless industry-leading noise canceling overhead headphones", price=399.99, stock=25),
            ]
            for p in products_seed:
                db.add(p)
            db.flush()
            
            # 2. Add customers
            customers_seed = [
                models.Customer(name="Alice Smith", email="alice.smith@example.com"),
                models.Customer(name="Bob Johnson", email="bob.johnson@example.com"),
                models.Customer(name="Charlie Brown", email="charlie.brown@example.com"),
            ]
            for c in customers_seed:
                db.add(c)
            db.flush()
            
            # 3. Add a completed order for Alice (ID 1)
            # Find Alice and products
            alice = db.query(models.Customer).filter(models.Customer.email == "alice.smith@example.com").first()
            iphone = db.query(models.Product).filter(models.Product.sku == "APL-128-IPH").first()
            mouse = db.query(models.Product).filter(models.Product.sku == "LOG-MX3-MST").first()
            
            if alice and iphone and mouse:
                # Deduct stock
                iphone.stock -= 1
                mouse.stock -= 2
                
                order = models.Order(
                    customer_id=alice.id,
                    total_price=(iphone.price * 1) + (mouse.price * 2),
                    status="Completed"
                )
                db.add(order)
                db.flush()
                
                item1 = models.OrderItem(order_id=order.id, product_id=iphone.id, quantity=1, unit_price=iphone.price)
                item2 = models.OrderItem(order_id=order.id, product_id=mouse.id, quantity=2, unit_price=mouse.price)
                db.add(item1)
                db.add(item2)
                
            db.commit()
            print("Successfully seeded initial data.")
    except Exception as e:
        db.rollback()
        print(f"Error seeding database: {e}")
    finally:
        db.close()


# --- Health Check ---
@app.get("/api/health")
def health_check():
    return {"status": "healthy", "time": time.time()}


# --- Dashboard Endpoint ---
@app.get("/api/dashboard/stats", response_model=schemas.DashboardStats)
def get_dashboard_stats(db: Session = Depends(get_db)):
    return crud.get_dashboard_stats(db)


# --- Products Endpoints ---

@app.get("/api/products", response_model=List[schemas.Product])
def read_products(
    skip: int = 0,
    limit: int = 100,
    search: Optional[str] = None,
    db: Session = Depends(get_db)
):
    return crud.get_products(db, skip=skip, limit=limit, search=search)

@app.get("/api/products/{product_id}", response_model=schemas.Product)
def read_product(product_id: int, db: Session = Depends(get_db)):
    db_product = crud.get_product(db, product_id=product_id)
    if not db_product:
        raise HTTPException(status_code=404, detail="Product not found")
    return db_product

@app.post("/api/products", response_model=schemas.Product, status_code=201)
def create_product(product: schemas.ProductCreate, db: Session = Depends(get_db)):
    try:
        return crud.create_product(db=db, product=product)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.put("/api/products/{product_id}", response_model=schemas.Product)
def update_product(product_id: int, product_update: schemas.ProductUpdate, db: Session = Depends(get_db)):
    try:
        db_product = crud.update_product(db=db, product_id=product_id, product_update=product_update)
        if not db_product:
            raise HTTPException(status_code=404, detail="Product not found")
        return db_product
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.delete("/api/products/{product_id}", response_model=schemas.Product)
def delete_product(product_id: int, db: Session = Depends(get_db)):
    db_product = crud.delete_product(db=db, product_id=product_id)
    if not db_product:
        raise HTTPException(status_code=404, detail="Product not found")
    return db_product


# --- Customers Endpoints ---

@app.get("/api/customers", response_model=List[schemas.Customer])
def read_customers(
    skip: int = 0,
    limit: int = 100,
    search: Optional[str] = None,
    db: Session = Depends(get_db)
):
    return crud.get_customers(db, skip=skip, limit=limit, search=search)

@app.get("/api/customers/{customer_id}", response_model=schemas.Customer)
def read_customer(customer_id: int, db: Session = Depends(get_db)):
    db_customer = crud.get_customer(db, customer_id=customer_id)
    if not db_customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    return db_customer

@app.post("/api/customers", response_model=schemas.Customer, status_code=201)
def create_customer(customer: schemas.CustomerCreate, db: Session = Depends(get_db)):
    try:
        return crud.create_customer(db=db, customer=customer)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.put("/api/customers/{customer_id}", response_model=schemas.Customer)
def update_customer(customer_id: int, customer_update: schemas.CustomerUpdate, db: Session = Depends(get_db)):
    try:
        db_customer = crud.update_customer(db=db, customer_id=customer_id, customer_update=customer_update)
        if not db_customer:
            raise HTTPException(status_code=404, detail="Customer not found")
        return db_customer
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.delete("/api/customers/{customer_id}", response_model=schemas.Customer)
def delete_customer(customer_id: int, db: Session = Depends(get_db)):
    db_customer = crud.delete_customer(db=db, customer_id=customer_id)
    if not db_customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    return db_customer


# --- Orders Endpoints ---

@app.get("/api/orders", response_model=List[schemas.OrderDetail])
def read_orders(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return crud.get_orders(db, skip=skip, limit=limit)

@app.get("/api/orders/{order_id}", response_model=schemas.OrderDetail)
def read_order(order_id: int, db: Session = Depends(get_db)):
    db_order = crud.get_order(db, order_id=order_id)
    if not db_order:
        raise HTTPException(status_code=404, detail="Order not found")
    return db_order

@app.post("/api/orders", response_model=schemas.Order, status_code=201)
def create_order(order_data: schemas.OrderCreate, db: Session = Depends(get_db)):
    try:
        return crud.create_order(db=db, order_data=order_data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.put("/api/orders/{order_id}/status", response_model=schemas.Order)
def update_order_status(
    order_id: int, 
    status_update: schemas.OrderUpdate, 
    db: Session = Depends(get_db)
):
    try:
        db_order = crud.update_order_status(db=db, order_id=order_id, status=status_update.status)
        if not db_order:
            raise HTTPException(status_code=404, detail="Order not found")
        return db_order
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/orders/{order_id}/cancel", response_model=schemas.Order)
def cancel_order(order_id: int, db: Session = Depends(get_db)):
    try:
        db_order = crud.cancel_order(db=db, order_id=order_id)
        if not db_order:
            raise HTTPException(status_code=404, detail="Order not found")
        return db_order
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
