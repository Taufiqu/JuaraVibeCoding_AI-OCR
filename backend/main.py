import os
from flask import Flask, jsonify
from flask_cors import CORS
from config import Config
from app.models import db
from app.routes import api_bp

def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    # Enable Cross-Origin Resource Sharing (CORS) for frontend interaction
    CORS(app, resources={r"/api/*": {"origins": "*"}})

    # Initialize Database with the application context
    db.init_app(app)

    # Register blueprints for routes
    app.register_blueprint(api_bp, url_prefix='/api')

    @app.route("/", methods=["GET"])
    def health_check():
        return jsonify({
            "status": "healthy",
            "app_name": "Universal AI Document Extractor",
            "engine": "Google Generative AI (Gemini 1.5 Flash)",
            "competition": "#JuaraVibeCoding"
        }), 200

    # Ensure all tables are created automatically on startup
    with app.app_context():
        db.create_all()

    return app

app = create_app()

if __name__ == "__main__":
    # Standard Flask dev-server port run
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)), debug=True)
