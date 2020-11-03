from flask import Blueprint, jsonify, request
from starter_app.models import db, User, Question
from flask_login import login_required
from sqlalchemy.orm import joinedload


bp = Blueprint('users', __name__)


@bp.route('/')
def index():
    response = User.query.all()
    return {"users": [user.to_dict() for user in response]}


@bp.route("/<int:user_id>/patch", methods=["GET", "PATCH"])
@login_required
def update(user_id):
    errors = []
    user = User.query.get_or_404(user_id)
    new_user_name = request.json.get("user_name")
    new_email = request.json.get("email")
    new_city = request.json.get("city")
    new_state = request.json.get("state")
    new_tags = request.json.get("tags")
    checked_user_name = list(db.session.query(User)
                             .filter(User.user_name == new_user_name))
    checked_email = list(db.session.query(User)
                         .filter(User.email == new_email))
    if len(checked_user_name) > 0:
        errors.append('Name already exists')
    else:
        user.user_name = new_user_name
    if len(checked_email) > 0:
        errors.append('Email already exists')
    else:
        user.email = new_email
    user.city = new_city
    user.state = new_state
    user.tags = new_tags
    db.session.commit()
    if len(errors) == 0:
        return {"user": user.to_dict()}
    else:
        return {'errors': errors, "user": user.to_dict()}


@bp.route('/<int:id>', methods=["GET", "POST"])
@login_required
def user_profile(id):
    return {}


@bp.route("/<int:user_id>/bookmarks", methods=["GET", "POST"])
@login_required
def bookmarks(user_id):
    if request.method == "POST":
        if not request.is_json:
            return jsonify({"msg": "Missing JSON in request"}), 400
        user = User.query.get_or_404(user_id)
        question_id = request.json.get("question_id", None)
        question = Question.query.get(question_id)
        user.questions.append(question)
        db.session.add(user)
        db.session.commit()
        return 'Question bookmarked', 200
    else:
        response = db.session.query(Question).order_by(
                      Question.title).options(
                      joinedload(Question.users)
                      ).filter(Question.users.any(id=user_id)).all()
        return {'bookmarked': [resp.to_dict() for resp in response]}


@bp.route("/<int:user_id>/tags/<int:rest_id>", methods=["DELETE"])
@login_required
def untag_favorite(rest_id, user_id):
    user = User.query.get_or_404(user_id)
    question = Question.query.filter_by(id=rest_id)
    user.questions.clear(question)
    db.session.add(user)
    db.session.commit()
    return 'Delete worked', 200
