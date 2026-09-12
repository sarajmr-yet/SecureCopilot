from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.models.vulnerability import Base

# Change le mot de passe si différent
DATABASE_URL = "postgresql://postgres:Sara00..@localhost:5432/secure_copilot"

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def init_db():
    Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()