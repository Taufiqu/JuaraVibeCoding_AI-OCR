from flask import Blueprint, request, jsonify
from app.models import db, ExtractionHistory
from app.services.ocr_service import process_document_with_gemini

# Establish clean api Blueprint
api_bp = Blueprint("api_bp", __name__)

@api_bp.route("/process", methods=["POST"])
def process_document():
    """
    POST /api/process
    Accepts standard multi-part form-data file upload (key name 'file')
    and optional user instructions string (key name 'user_prompt').
    Retrieves and saves structured output in DB.
    """
    if "file" not in request.files:
        return jsonify({"error": "Request body missing target multipart file block ('file')"}), 400

    file_obj = request.files["file"]
    if file_obj.filename == "":
        return jsonify({"error": "Filename is undefined"}), 400

    filename = file_obj.filename
    # Infer mime-type or default to safe common standard
    mime_type = file_obj.content_type or "image/jpeg"
    user_prompt = request.form.get("user_prompt", "").strip() or None

    try:
        # Load raw bytes of the file directly
        file_bytes = file_obj.read()
        if not file_bytes:
            return jsonify({"error": "File stream evaluated as empty"}), 400

        # Execute extraction using Python Google GenAI model service
        gemini_result = process_document_with_gemini(
            file_bytes=file_bytes,
            mime_type=mime_type,
            user_prompt=user_prompt
        )

        doc_type = gemini_result.get("document_type", "Unknown Document")
        extracted_data = gemini_result.get("extracted_data", {})

        # Persist the dynamic extracted metadata to SQLite/PostgreSQL
        history_item = ExtractionHistory(
            filename=filename,
            doc_type=doc_type,
            extracted_data=extracted_data,
            user_prompt=user_prompt
        )
        
        db.session.add(history_item)
        db.session.commit()

        # Structure response
        return jsonify({
            "success": True,
            "message": "Document processed and recorded successfully.",
            "record": history_item.to_dict()
        }), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({
            "success": False,
            "error": "Processing cycle failed.",
            "details": str(e)
        }), 500

@api_bp.route("/history", methods=["GET"])
def get_histories():
    """
    GET /api/history
    Fetches the history stream sorted by creation timestamp descending.
    """
    try:
        records = ExtractionHistory.query.order_by(ExtractionHistory.created_at.desc()).all()
        return jsonify([r.to_dict() for r in records]), 200
    except Exception as e:
        return jsonify({
            "success": False,
            "error": "Failed to retrieve history logs.",
            "details": str(e)
        }), 500

@api_bp.route("/history/<int:record_id>", methods=["DELETE"])
def delete_history_record(record_id):
    """
    DELETE /api/history/<id>
    Unsubscribes / removes a record from database history.
    """
    try:
        record = db.session.get(ExtractionHistory, record_id)
        if not record:
            return jsonify({
                "success": False,
                "error": f"Record containing ID {record_id} does not exist."
            }), 404

        db.session.delete(record)
        db.session.commit()

        return jsonify({
            "success": True,
            "message": f"Successfully deleted record with ID {record_id}."
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({
            "success": False,
            "error": f"Failed to remove record {record_id}.",
            "details": str(e)
        }), 500
