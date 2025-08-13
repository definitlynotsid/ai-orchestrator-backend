from sqlalchemy import Column, Integer, String, ForeignKey, Text
from sqlalchemy.orm import declarative_base, relationship
from pydantic import BaseModel
from typing import List, Optional

Base = declarative_base()

# --- SQLAlchemy Models ---

class Workflow(Base):
    __tablename__ = "workflows"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True, nullable=False)
    description = Column(Text, nullable=True)

    # Relationship: One Workflow → Many WorkflowSteps
    steps = relationship("WorkflowStep", back_populates="workflow", cascade="all, delete-orphan")


class WorkflowStep(Base):
    __tablename__ = "workflow_steps"

    id = Column(Integer, primary_key=True, index=True)
    step_number = Column(Integer, nullable=False)
    prompt = Column(Text, nullable=False)

    workflow_id = Column(Integer, ForeignKey("workflows.id"), nullable=False)
    workflow = relationship("Workflow", back_populates="steps")


# --- Pydantic Schemas (for API requests/responses) ---

class WorkflowStepBase(BaseModel):
    step_number: int
    prompt: str


class WorkflowStepCreateModel(WorkflowStepBase):
    pass


class WorkflowStepModel(WorkflowStepBase):
    id: int

    class Config:
        orm_mode = True


class WorkflowBase(BaseModel):
    name: str
    description: Optional[str] = None


class WorkflowCreateModel(WorkflowBase):
    pass


class WorkflowModel(WorkflowBase):
    id: int
    steps: List[WorkflowStepModel] = []

    class Config:
        orm_mode = True


# --- Database Creation Helper ---
def create_db_and_tables(engine=None):
    from sqlalchemy import create_engine
    import os

    if engine is None:
        DATABASE_URL = os.getenv("DATABASE_URL")
        if not DATABASE_URL:
            raise ValueError("DATABASE_URL environment variable is not set.")
        engine = create_engine(DATABASE_URL)

    Base.metadata.create_all(bind=engine)

