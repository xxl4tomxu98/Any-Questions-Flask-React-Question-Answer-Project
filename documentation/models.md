from datetime import datetime
import hashlib
import math
from itsdangerous import TimedJSONWebSignatureSerializer as Serializer
from werkzeug.security import generate_password_hash, check_password_hash
from markdown import markdown
import bleach
from flask import current_app, request, url_for
from flask.ext.login import UserMixin, AnonymousUserMixin, current_user
from . import db, login_manager
from .exceptions import ValidationError
import sqlalchemy as sa
from sqlalchemy_continuum import make_versioned
from sqlalchemy_continuum.plugins import ActivityPlugin, FlaskPlugin


activity_plugin = ActivityPlugin()
make_versioned(plugins=[activity_plugin, FlaskPlugin()])


class Permission:
    FOLLOW = 0x01
    COMMENT = 0x02
    ASK = 0x04
    ANSWER = 0x08
    MODERATE_COMMENTS = 0x10
    ADMINISTER = 0x80


class Role(db.Model):
    __tablename__ = 'roles'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(64), unique=True)
    default = db.Column(db.Boolean, default=False, index=True)
    permissions = db.Column(db.Integer)
    users = db.relationship('User', backref='role', lazy='dynamic')

    @staticmethod
    def insert_roles():
        roles = {
            'User': (Permission.FOLLOW |
                     Permission.COMMENT |
                     Permission.ASK |
                     Permission.ANSWER, True),
            'Moderator': (Permission.FOLLOW |
                          Permission.COMMENT |
                          Permission.ASK |
                          Permission.ANSWER |
                          Permission.MODERATE_COMMENTS, False),
            'Administrator': (0xff, False)
        }
        for r in roles:
            role = Role.query.filter_by(name=r).first()
            if role is None:
                role = Role(name=r)
            role.permissions = roles[r][0]
            role.default = roles[r][1]
            db.session.add(role)
        db.session.commit()

    def __repr__(self):
        return '<Role %r>' % self.name


class Follow(db.Model):
    __tablename__ = 'follows'
    follower_id = db.Column(db.Integer, db.ForeignKey('users.id'), primary_key=True)
    followed_id = db.Column(db.Integer, db.ForeignKey('users.id'), primary_key=True)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)


class User(UserMixin, db.Model):
    __tablename__ = 'users'
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(64), unique=True, index=True)
    username = db.Column(db.String(64), unique=True, index=True)
    role_id = db.Column(db.Integer, db.ForeignKey('roles.id'))
    password_hash = db.Column(db.String(128))
    confirmed = db.Column(db.Boolean, default=False)
    name = db.Column(db.String(64))
    location = db.Column(db.String(64))
    about_me = db.Column(db.Text())
    member_since = db.Column(db.DateTime(), default=datetime.utcnow)
    last_seen = db.Column(db.DateTime(), default=datetime.utcnow)
    avatar_hash = db.Column(db.String(32))
    questions = db.relationship('Question', backref='author', lazy='dynamic')
    followed = db.relationship('Follow',
                               foreign_keys=[Follow.follower_id],
                               backref=db.backref('follower', lazy='joined'),
                               lazy='dynamic',
                               cascade='all, delete-orphan')
    followers = db.relationship('Follow',
                                foreign_keys=[Follow.followed_id],
                                backref=db.backref('followed', lazy='joined'),
                                lazy='dynamic',
                                cascade='all, delete-orphan')
    answers = db.relationship('Answer', backref='author', lazy='dynamic')
    comments = db.relationship('Comment', backref='author', lazy='dynamic')
    votes = db.relationship('Vote', lazy='dynamic', cascade='all, delete-orphan')

    @staticmethod
    def generate_fake(count=100):
        from sqlalchemy.exc import IntegrityError
        from random import seed
        import forgery_py

        seed()
        for i in range(count):
            u = User(email=forgery_py.internet.email_address(),
                     username=forgery_py.internet.user_name(True),
                     password=forgery_py.lorem_ipsum.word(),
                     confirmed=True,
                     name=forgery_py.name.full_name(),
                     location=forgery_py.address.city(),
                     about_me=forgery_py.lorem_ipsum.sentence(),
                     member_since=forgery_py.date.date(True))
            db.session.add(u)
            try:
                db.session.commit()
            except IntegrityError:
                db.session.rollback()


    def __init__(self, **kwargs):
        super(User, self).__init__(**kwargs)
        if self.role is None:
            if self.email == current_app.config['FLASKQ_ADMIN']:
                self.role = Role.query.filter_by(permissions=0xff).first()
            if self.role is None:
                self.role = Role.query.filter_by(default=True).first()
        if self.email is not None and self.avatar_hash is None:
            self.avatar_hash = hashlib.md5(
                    self.email.encode('utf-8')).hexdigest()

    @property
    def password(self):
        raise AttributeError('password is not a readable attribute')

    @password.setter
    def password(self, password):
        self.password_hash = generate_password_hash(password)

    def verify_password(self, password):
        return check_password_hash(self.password_hash, password)

    def generate_confirmation_token(self, expiration=3600):
        s = Serializer(current_app.config['SECRET_KEY'], expiration)
        return s.dumps({'confirm': self.id})

    def confirm(self, token):
        s = Serializer(current_app.config['SECRET_KEY'])
        try:
            data = s.loads(token)
        except:
            return False
        if data.get('confirm') != self.id:
            return False
        self.confirmed = True
        db.session.add(self)
        return True

    def generate_reset_token(self, expiration=3600):
        s = Serializer(current_app.config['SECRET_KEY'], expiration)
        return s.dumps({'reset': self.id})

    def reset_password(self, token, new_password):
        s = Serializer(current_app.config['SECRET_KEY'])
        try:
            data = s.loads(token)
        except:
            return False
        if data.get('reset') != self.id:
            return False
        self.password = new_password
        db.session.add(self)
        return True

    def generate_email_change_token(self, new_email, expiration=3600):
        s = Serializer(current_app.config['SECRET_KEY'], expiration)
        return s.dumps({'change_email': self.id, 'new_email': new_email})

    def change_email(self, token):
        s = Serializer(current_app.config['SECRET_KEY'])
        try:
            data = s.loads(token)
        except:
            return False
        if data.get('change_email') != self.id:
            return False
        new_email = data.get('new_email')
        if new_email is None:
            return False
        if User.query.filter_by(email=new_email).first() is not None:
            return False
        self.email = new_email
        self.avatar_hash = hashlib.md5(
                self.email.encode('utf-8')).hexdigest()
        db.session.add(self)
        return True

    def can(self, permissions):
        return self.role is not None and \
               (self.role.permissions & permissions) == permissions

    def is_administrator(self):
        return self.can(Permission.ADMINISTER)

    def ping(self):
        self.last_seen = datetime.utcnow()
        db.session.add(self)

    def gravatar(self, size=100, default='identicon', rating='g'):
        if request.is_secure:
            url = 'https://secure.gravatar.com/avatar'
        else:
            url = 'http://cn.gravatar.com/avatar'
        hash = self.avatar_hash or hashlib.md5(
                self.email.encode('utf-8')).hexdigest()
        return '{url}/{hash}?s={size}&d={default}&r={rating}'.format(
                url=url, hash=hash, size=size, default=default, rating=rating)

    def follow(self, user):
        if not self.is_following(user):
            f = Follow(follower=self, followed=user)
            db.session.add(f)

    def unfollow(self, user):
        f = self.followed.filter_by(followed_id=user.id).first()
        if f:
            db.session.delete(f)

    def is_following(self, user):
        return self.followed.filter_by(
                followed_id=user.id).first() is not None

    def is_followed_by(self, user):
        return self.followers.filter_by(
                follower_id=user.id).first() is not None

    def vote(self, answer, type):
        v = self.is_voted(answer)
        if not v:
            v = Vote(voter_id=self.id, answer_id=answer.id,
                     type=type)
            db.session.add(v)
            # change answer votes
            if type == 'up':
                answer.upvotes += 1
                # activity
                db.session.flush()
                upvote_activity = Activity(verb='upvoted', object=answer,
                                  actor_id=self.id, timestamp=v.timestamp)
                db.session.add(upvote_activity)
            else:
                answer.downvotes += 1
            answer.ranking = generate_ranking(answer.upvotes, answer.downvotes)
            db.session.add(answer)
            db.session.commit()
        elif v.type != type:
            v.type = type
            db.session.add(v)
            # change answer votes
            if type == 'up':
                answer.upvotes += 1
                answer.downvotes -= 1
            else:
                answer.downvotes += 1
                answer.upvotes -= 1
            answer.ranking = generate_ranking(answer.upvotes, answer.downvotes)
            db.session.add(answer)
            db.session.commit()

    def unvote(self, answer, type):
        v = self.votes.filter_by(answer_id=answer.id).first()
        if v:
            db.session.delete(v)
            # change answer votes
            if type == 'up':
                answer.upvotes -= 1
            else:
                answer.downvotes -= 1
            answer.ranking = generate_ranking(answer.upvotes, answer.downvotes)
            db.session.add(answer)
            db.session.commit()

    def is_voted(self, answer):
        vote = self.votes.filter_by(answer_id=answer.id).first()
        if vote is None:
            return False
        return vote

    def is_answered(self, question):
        return Answer.query.filter_by(question_id=question.id, author_id=self.id).first()

    @property
    def followed_questions(self):
        return Question.query.join(Follow, Follow.followed_id == Question.author_id) \
            .filter(Follow.follower_id == self.id)

    @property
    def followed_activities(self):
        return Activity.query.join(Follow, Follow.followed_id == Activity.actor_id) \
            .filter(Follow.follower_id == self.id)

    def to_json(self):
        json_user = {
            'url': url_for('api.get_user', id=self.id, _external=True),
            'username': self.username,
            'member_since': self.member_since,
            'last_seen': self.last_seen,
            'questions': url_for('api.get_user_questions', id=self.id,
                                 _external=True),
            'answers': url_for('api.get_user_answers', id=self.id,
                               _external=True),
            'followed_activities': url_for('api.get_user_followed_activities',
                                           id=self.id, _external=True),
            'question_count': self.questions.count(),
            'answer_count': self.answers.count()
        }
        return json_user

    def generate_auth_token(self, expiration):
        s = Serializer(current_app.config['SECRET_KEY'],
                       expires_in=expiration)
        return s.dumps({'id': self.id}).decode('utf-8')

    @staticmethod
    def verify_auth_token(token):
        s = Serializer(current_app.config['SECRET_KEY'])
        try:
            data = s.loads(token)
        except:
            return None
        return User.query.get(data['id'])

    def __repr__(self):
        return '<User %r>' % self.username


@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))


class AnonymousUser(AnonymousUserMixin):
    def can(self, permissions):
        return False

    def is_administrator(self):
        return False


login_manager.anonymous_user = AnonymousUser


class Question(db.Model):
    __versioned__ = {}
    __tablename__ = 'questions'
    id = db.Column(db.Integer, primary_key=True)
    body = db.Column(db.String(64))
    detail = db.Column(db.Text)
    timestamp = db.Column(db.DateTime, index=True, default=datetime.utcnow)
    author_id = db.Column(db.Integer, db.ForeignKey('users.id'))
    answers = db.relationship('Answer', backref='question', lazy='dynamic')
    comments = db.relationship('Comment', backref='question', lazy='dynamic')

    @staticmethod
    def generate_fake(count=100):
        from random import seed, randint
        import forgery_py

        seed()
        user_count = User.query.count()
        for i in range(count):
            u = User.query.offset(randint(0, user_count - 1)).first()
            q = Question(body=forgery_py.lorem_ipsum.sentence(),
                         detail=forgery_py.lorem_ipsum.sentences(randint(1, 5)),
                         timestamp=forgery_py.date.date(True),
                         author=u)
            db.session.add(q)
            db.session.commit()

    def to_json(self):
        json_question = {
            'url': url_for('api.get_question', id=self.id, _external=True),
            'body': self.body,
            'detail': self.detail,
            'timestamp': self.timestamp,
            'author': url_for('api.get_user', id=self.author_id,
                              _external=True),
            'answers': url_for('api.get_question_answers', id=self.id,
                               _external=True),
            'answer_count': self.answers.count(),
            'comments': url_for('api.get_question_comments', id=self.id,
                                _external=True),
            'comment_count': self.comments.count()
        }
        return json_question

    @staticmethod
    def from_json(json_question):
        body = json_question.get('body')
        if body is None or body == '':
            raise ValidationError('question does not have a body')
        return Question(body=body)


class Answer(db.Model):
    __versioned__ = {}
    __tablename__ = 'answers'
    id = db.Column(db.Integer, primary_key=True)
    body = db.Column(db.Text)
    body_html = db.Column(db.Text)
    timestamp = db.Column(db.DateTime, index=True, default=datetime.utcnow)
    author_id = db.Column(db.Integer, db.ForeignKey('users.id'))
    question_id = db.Column(db.Integer, db.ForeignKey('questions.id'))
    comments = db.relationship('Comment', backref='answer', lazy='dynamic')
    upvotes = db.Column(db.Integer, default=0)
    downvotes = db.Column(db.Integer, default=0)
    ranking = db.Column(db.Float, index=True, default=0)

    @staticmethod
    def on_changed_body(target, value, oldvalue, initiator):
        allowed_tags = ['a', 'abbr', 'acronym', 'b', 'blockquote', 'code',
                        'em', 'i', 'img', 'li', 'ol', 'pre', 'strong', 'ul',
                        'h1', 'h2', 'h3', 'p']
        allowed_attrs = {'*': ['class'],
                         'a': ['href', 'rel'],
                         'img': ['src', 'alt']}
        target.body_html = bleach.linkify(bleach.clean(
                markdown(value, output_format='html'),
                tags=allowed_tags, attributes=allowed_attrs, strip=True))

    def to_json(self):
        json_answer = {
            'url': url_for('api.get_answer', id=self.id, _external=True),
            'question': url_for('api.get_question', id=self.question_id,
                                _external=True),
            'body': self.body,
            'body_html': self.body_html,
            'timestamp': self.timestamp,
            'author': url_for('api.get_user', id=self.author_id,
                              _external=True),
            'upvotes': self.upvotes,
            'ranking': self.ranking
        }
        return json_answer

    @staticmethod
    def from_json(json_answer):
        body = json_answer.get('body')
        if body is None or body == '':
            raise ValidationError('answer does not have a body')
        return Answer(body=body)


def generate_ranking(upvotes, downvotes):
    n = upvotes + downvotes
    if n == 0:
        return 0
    p = upvotes / n
    z = 1.96
    denominator = 1 + (1 / n) * z ** 2
    radicand = p / n * (1 - p) + z ** 2 / (4 * n ** 2)
    numerator = p + z ** 2 / (2 * n)
    numerator -= z * math.sqrt(radicand)
    ranking = numerator / denominator
    return ranking


db.event.listen(Answer.body, 'set', Answer.on_changed_body)


class Comment(db.Model):
    __tablename__ = 'comments'
    id = db.Column(db.Integer, primary_key=True)
    body = db.Column(db.String(64))
    timestamp = db.Column(db.DateTime, index=True, default=datetime.utcnow)
    disabled = db.Column(db.Boolean)
    author_id = db.Column(db.Integer, db.ForeignKey('users.id'))
    question_id = db.Column(db.Integer, db.ForeignKey('questions.id'))
    answer_id = db.Column(db.Integer, db.ForeignKey('answers.id'))

    def to_json(self):
        json_comment = {
            'url': url_for('api.get_comment', id=self.id, _external=True),
            'body': self.body,
            'timestamp': self.timestamp,
            'author': url_for('api.get_user', id=self.author_id, _external=True)
        }
        if self.question_id:
            json_comment['question'] = url_for(
                    'api.get_question', id=self.question_id, _external=True)
        if self.answer_id:
            json_comment['answer'] = url_for(
                    'api.get_answer', id=self.answer_id, _external=True)
        return json_comment

    @staticmethod
    def from_json(json_comment):
        body = json_comment.get('body')
        if body is None or body == '':
            raise ValidationError('comment does not have a body')
        return Comment(body=body)


class Vote(db.Model):
    __versioned__ = {}
    __tablename__ = 'votes'
    voter_id = db.Column(db.Integer, db.ForeignKey('users.id'), primary_key=True)
    answer_id = db.Column(db.Integer, db.ForeignKey('answers.id'), primary_key=True)
    type = db.Column(db.Enum("up", "down", name="vote_type"))
    timestamp = db.Column(db.DateTime, index=True, default=datetime.utcnow)


# after you have defined all your models, call configure_mappers:
sa.orm.configure_mappers()
Activity = activity_plugin.activity_cls
