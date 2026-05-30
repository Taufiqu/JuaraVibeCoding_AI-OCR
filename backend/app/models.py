from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

# Initialize database globally inside models to prevent circular import issues
db = SQLAlchemy()

class ExtractionHistory(db.Model):
    __tablename__ = "extraction_histories"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    filename = db.Column(db.String(255), nullable=False)
    
    # Auto-detected by Gemini (e.g. Tax Invoice, National ID Card, Bank Statement)
    doc_type = db.Column(db.String(100), nullable=False, default="Unknown Document")
    
    # Flexible JSON storage to house any dynamic key-value result structured output
    extracted_data = db.Column(db.JSON, nullable=False)
    
    # Custom prompt instructions supplied by user, if any
    user_prompt = db.Column(db.Text, nullable=True)
    
    # Creation timestamp
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        """Converts model instance fields into a dictionary for JSON serialization."""
        return {
            "id": self.id,
            "filename": self.filename,
            "doc_type": self.doc_type,
            "extracted_data": self.extracted_data,
            "user_prompt": self.user_prompt,
            "created_at": self.created_at.isoformat() + "Z" if self.created_at else None
        }
