from pydantic import BaseModel, EmailStr, Field, field_validator
from typing import List, Optional
from datetime import datetime

# --- Product Schemas ---
class ProductBase(BaseModel):
    sku: str = Field(..., min_length=1, description="Unique stock keeping unit")
    name: str = Field(..., min_length=1)
    description: Optional[str] = None
    price: float = Field(..., gt=0, description="Product price must be greater than zero")
    stock: int = Field(..., ge=0, description="Stock cannot be negative")

class ProductCreate(ProductBase):
    pass

class ProductUpdate(BaseModel):
    sku: Optional[str] = Field(None, min_length=1)
    name: Optional[str] = Field(None, min_length=1)
    description: Optional[str] = None
    price: Optional[float] = Field(None, gt=0)
    stock: Optional[int] = Field(None, ge=0)

class Product(ProductBase):
    id: int

    class Config:
        from_attributes = True


# --- Customer Schemas ---
class CustomerBase(BaseModel):
    name: str = Field(..., min_length=1)
    email: EmailStr

class CustomerCreate(CustomerBase):
    pass

class CustomerUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1)
    email: Optional[EmailStr] = None

class Customer(CustomerBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


# --- OrderItem Schemas ---
class OrderItemBase(BaseModel):
    product_id: int
    quantity: int = Field(..., gt=0, description="Quantity must be greater than zero")

class OrderItemCreate(OrderItemBase):
    pass

class OrderItem(OrderItemBase):
    id: int
    order_id: int
    unit_price: float

    class Config:
        from_attributes = True

class ProductMini(BaseModel):
    id: int
    name: str
    sku: str
    price: float

    class Config:
        from_attributes = True

class OrderItemDetail(OrderItem):
    product: ProductMini

    class Config:
        from_attributes = True


# --- Order Schemas ---
class OrderCreate(BaseModel):
    customer_id: int
    items: List[OrderItemCreate] = Field(..., min_length=1, description="Order must contain at least one item")

class OrderUpdate(BaseModel):
    status: str = Field(..., description="Status must be Pending, Completed, or Cancelled")

    @field_validator('status')
    def validate_status(cls, v):
        allowed = ["Pending", "Completed", "Cancelled"]
        if v not in allowed:
            raise ValueError(f"Status must be one of {allowed}")
        return v

class Order(BaseModel):
    id: int
    customer_id: int
    total_price: float
    status: str
    created_at: datetime
    items: List[OrderItem]

    class Config:
        from_attributes = True

class OrderDetail(BaseModel):
    id: int
    customer: Customer
    total_price: float
    status: str
    created_at: datetime
    items: List[OrderItemDetail]

    class Config:
        from_attributes = True


# --- Dashboard Stats ---
class DashboardStats(BaseModel):
    total_products: int
    total_customers: int
    total_orders: int
    low_stock_count: int
    total_sales: float
    recent_orders: List[Order]
