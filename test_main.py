import unittest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import sys
import os

# Adjust path to import app correctly
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import Base, get_db
from app.main import app
from app import models

# Use a local SQLite database for testing
SQLALCHEMY_DATABASE_URL = "sqlite:///./test_temp.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Override get_db dependency
def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)

class TestInventoryAPI(unittest.TestCase):
    
    @classmethod
    def setUpClass(cls):
        # Create tables
        Base.metadata.create_all(bind=engine)
        
    @classmethod
    def tearDownClass(cls):
        # Drop tables and remove file
        Base.metadata.drop_all(bind=engine)
        try:
            os.remove("./test_temp.db")
        except OSError:
            pass

    def setUp(self):
        # Clear tables before each test to ensure test isolation
        db = TestingSessionLocal()
        db.query(models.OrderItem).delete()
        db.query(models.Order).delete()
        db.query(models.Product).delete()
        db.query(models.Customer).delete()
        db.commit()
        db.close()

    def test_product_lifecycle_and_sku_uniqueness(self):
        # 1. Create a product
        payload = {
            "sku": "TST-SKU-1",
            "name": "Test Product 1",
            "description": "This is a test product",
            "price": 19.99,
            "stock": 10
        }
        response = client.post("/api/products", json=payload)
        self.assertEqual(response.status_code, 201)
        data = response.json()
        self.assertEqual(data["sku"], "TST-SKU-1")
        self.assertEqual(data["stock"], 10)
        product_id = data["id"]

        # 2. Attempt to create another product with the same SKU (should fail)
        response = client.post("/api/products", json=payload)
        self.assertEqual(response.status_code, 400)
        self.assertIn("already exists", response.json()["detail"])

        # 3. Update stock and name
        update_payload = {
            "name": "Updated Test Product 1",
            "stock": 15
        }
        response = client.put(f"/api/products/{product_id}", json=update_payload)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["name"], "Updated Test Product 1")
        self.assertEqual(response.json()["stock"], 15)

    def test_customer_lifecycle_and_email_uniqueness(self):
        # 1. Create a customer
        payload = {
            "name": "Test Customer",
            "email": "test@example.com"
        }
        response = client.post("/api/customers", json=payload)
        self.assertEqual(response.status_code, 201)
        data = response.json()
        self.assertEqual(data["name"], "Test Customer")
        self.assertEqual(data["email"], "test@example.com")
        customer_id = data["id"]

        # 2. Attempt to create customer with same email (should fail)
        response = client.post("/api/customers", json=payload)
        self.assertEqual(response.status_code, 400)
        self.assertIn("already exists", response.json()["detail"])

        # 3. Update email
        update_payload = {
            "email": "updated@example.com"
        }
        response = client.put(f"/api/customers/{customer_id}", json=update_payload)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["email"], "updated@example.com")

    def test_order_creation_stock_validation_and_cancellation(self):
        # Setup: Create a customer and a product
        c_res = client.post("/api/customers", json={"name": "Bob", "email": "bob@example.com"})
        p_res = client.post("/api/products", json={"sku": "PROD-1", "name": "Item A", "price": 100.0, "stock": 5})
        
        customer_id = c_res.json()["id"]
        product_id = p_res.json()["id"]

        # 1. Place order within stock levels
        order_payload = {
            "customer_id": customer_id,
            "items": [
                {"product_id": product_id, "quantity": 3}
            ]
        }
        response = client.post("/api/orders", json=order_payload)
        self.assertEqual(response.status_code, 201)
        order_data = response.json()
        self.assertEqual(order_data["total_price"], 300.0)
        order_id = order_data["id"]

        # Verify stock decreased from 5 to 2
        p_check = client.get(f"/api/products/{product_id}")
        self.assertEqual(p_check.json()["stock"], 2)

        # 2. Place order exceeding remaining stock (should fail)
        exceed_payload = {
            "customer_id": customer_id,
            "items": [
                {"product_id": product_id, "quantity": 4}
            ]
        }
        response = client.post("/api/orders", json=exceed_payload)
        self.assertEqual(response.status_code, 400)
        self.assertIn("Insufficient stock", response.json()["detail"])

        # Verify stock remains unchanged (2)
        p_check = client.get(f"/api/products/{product_id}")
        self.assertEqual(p_check.json()["stock"], 2)

        # 3. Cancel order and verify stock restored
        response = client.post(f"/api/orders/{order_id}/cancel")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "Cancelled")

        # Verify stock restored to 5
        p_check = client.get(f"/api/products/{product_id}")
        self.assertEqual(p_check.json()["stock"], 5)

if __name__ == "__main__":
    unittest.main()
