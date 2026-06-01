from pydantic_settings import BaseSettings
from pydantic import Field

class Settings(BaseSettings):
    PROJECT_NAME: str = "Inventory & Order Management API"
    DATABASE_URL: str = "postgresql://postgres:postgrespassword@localhost:5432/inventory_db"
    ENVIRONMENT: str = "development"

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()
