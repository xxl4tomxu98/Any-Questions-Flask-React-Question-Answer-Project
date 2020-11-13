import React, {useEffect,Fragment} from 'react';
import { useSelector, useDispatch } from 'react-redux';
import moment from 'moment';
import { getUser, getFollowers } from '../store/users';
import { Link, useParams } from 'react-router-dom';
import { ReactComponent as Logo } from '../assets/quiz.svg';
import SideBar from './HomePage/SideBar';
import RightSideBar from './HomePage/RightSideBar';
import './UserPage.css'
import Spinner from "./Spinner";


const UserPage = () => {
    const user = useSelector(state => state.users.detail);
    const followers = useSelector(state => state.users.followers);
    const { userId } = useParams();
    const dispatch = useDispatch();
    useEffect(() => {
        dispatch(getUser(userId));
        dispatch(getFollowers(userId));
    }, [dispatch, userId]);

    return user === null ? <Spinner type='page' width='75px' height='200px'/> : <Fragment>
        <div className='page'>
            <SideBar/>
            <div id="content">
                <div id='mainbar' className='user-main-bar pl24 pt24'>
                    <div className='user-card'>
                        <div className="grid--cell s-navigation mb16">
                            <Link to="#" className="s-navigation--item is-selected"
                               data-shortcut="P">Individual User</Link>
                            <Link to="#" className="s-navigation--item"
                               data-shortcut="A"> Activity</Link>
                        </div>
                        <div className='grid'>
                            <div className='img-card'>
                                <div className='avatar-card'>
                                    <div className='avatar'>
                                        <Link className='avatar-link' to={`/users/${user.id}`}>
                                            <div className='logo-wrapper'>
                                                <img src='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAOEAAADhCAMAAAAJbSJIAAAANlBMVEXw8PDdy4Xx8vXcyX7s6Nzg0prr59jh05/cyHvt6t/f0JXbx3bx8/fdy4Pj16vv7uzezIro4cj87/UvAAACA0lEQVR4nO3cYU7CUBCFUYRWWrSo+9+sS+BOMg9e9HwLmM5p4BdkTidJkiRJkvRH+1r6+koeuPc9b4+Ey8elq4/34Hnndet63nY7R8LLW1eXSHg9up53rISE1QgJqxES1iMkrEZIWI+QsBohYT1CwmqEhPUICasREtYjJKxGSFiP8FXC7UiKhMvn+WGfmTBaKhPutzXoO1nrWK9B2ahoq3skPD1+7b0vvu/jcM6A2Vvo+/JkRV/pzggJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQn/jzD8lbtT2PcLdnQ1Yl+z3/GTSwjZpJ/kuETn1YhwrffHLX0v6xVXI4InNn7g/SeKsB4hYTVCwnqEhNUICesRElYjJKxHSFiNkLAeIWE1QsJ6hITVCAnrEc4tTE4JbJnw0nWWoFX4nRxxuC2J8B6Nyq5U9AmPte+IQ3SlYs+26hQ2nqB49laEhGMiJBw1qy9CwlGz+iIkHDWrL0LCUbP6IiQcNasvQsJRs/oiJBw1qy9CwlGz+iIkHDWrL0LCUbP6InyRMDpAkZ16mFQYHaDITj3MKpxy1KRrERLOvxYh4fxrERLOvxYh4fxrERLOvxYh4fxrERLOvxYh4fxrERLOvxYh4fxrERLOv1arcEuOOGRrTTnqtN+SKw73ZNaco7IrDo0HIZ4/SpIkSZKkP9gvDI+byX8+aAgAAAAASUVORK5CYII=' alt='user-logo'/>
                                            </div>
                                        </Link>
                                    </div>
                                    <div className='title'>
                                        <div className='grid fc-black-800'>
                                            319
                                            &nbsp;
                                            <span className='fc-light'>
                                                REPUTATION
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className='content-card'>
                                <div className='content-grid'>
                                    <div className='info-cell'>
                                        <div className='info'>
                                            <div className='details'>
                                                <h2>{user.username}</h2>
                                            </div>
                                            <div className='date'>
                                                <p>
                                                    user created &nbsp;-&nbsp;{ moment(user.member_since).fromNow(true) } ago
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className='stats-cell'>
                                        <div className='count-sec'>
                                            <div className='counts'>
                                                <div className='cells'>
                                                    <div className='column-grid'>
                                                        <div className='head fc-black-700'>
                                                            {user.answer_count}
                                                        </div>
                                                        <div className='foot fc-black-500'>
                                                            answers
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className='cells'>
                                                    <div className='column-grid'>
                                                        <div className='head fc-black-700'>
                                                            {user.posts_count}
                                                        </div>
                                                        <div className='foot fc-black-500'>
                                                            questions
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className='cells'>
                                                    <div className='column-grid'>
                                                        <div className='head fc-black-700'>
                                                            {user.comment_count}
                                                        </div>
                                                        <div className='foot fc-black-500'>
                                                            comments
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className='cells'>
                                                    <div className='column-grid'>
                                                        <div className='head fc-black-700'>
                                                            {user.tag_count}
                                                        </div>
                                                        <div className='foot fc-black-500'>
                                                            tags
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className='cells'>
                                                    <div className='column-grid'>
                                                        <div className='head fc-black-700'>
                                                            {user.follower_count}
                                                        </div>
                                                        <div className='foot fc-black-500'>
                                                            followers
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className='cells'>
                                                    <div className='column-grid'>
                                                        <div className='head fc-black-700'>
                                                            {user.following_count}
                                                        </div>
                                                        <div className='foot fc-black-500'>
                                                            following
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className='row-grid'>
                        <div className='grid-cell1'>
                            <div className='cell-layout'>
                                <div className='community'>
                                    <h3 className='bc-black-3'>
                                        <span className='icon'>
                                            <svg aria-hidden='true' className='svg-icon native icon-logo-sex' width='18' height='18' viewBox='0 0 18 18'>
                                                <path d='M3 4c0-1.1.9-2 2-2h8a2 2 0 0 1 2 2H3z' fill='#8FD8F7'/>
                                                <path d='M15 11H3c0 1.1.9 2 2 2h5v3l3-3a2 2 0 0 0 2-2z' fill='#155397'/>
                                                <path fill='#46A2D9' d='M3 5h12v2H3z'/><path fill='#2D6DB5' d='M3 8h12v2H3z'/>
                                            </svg>
                                        </span>
                                        <span className='text fw-bold fc-dark bc-black-3'>Communities</span>
                                    </h3>
                                    <ul>
                                        <li className='item'><Link to='/'>
                                            <span><Logo className='logo'/></span>
                                            <span className='fc-blue-600 fs-body2'>Any Questions</span>
                                        </Link></li>
                                    </ul>
                                </div>
                                <div className='user-posts'>
                                    <h3 className='fw-bold fc-dark bc-black-3'>
                                        Top network posts
                                    </h3>
                                    <p className='fc-light'>
                                    We respect a laser-like focus on one topic. User posted threads are presented in their logical order so that thoughts and ideas flows are traced.
                                    </p>
                                </div>
                                <div className='user-posts'>
                                    <h3 className='fw-bold fc-dark bc-black-3'>
                                        Followers
                                    </h3>
                                    <div className='fc-light'>
                                    {followers.map(follower => (
                                     <div key={follower.id}>
                                        <a className='s-tag s-tag__md' href={`/users/${follower.id}`}>
                                          {follower.user_name}
                                        </a>
                                     </div>  ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className='grid-cell2'>
                            <div className='top-tags'>
                                <h3 className='fw-bold fc-dark bc-black-3'>
                                    Top Tags
                                </h3>
                                <div className='top-tags-sec'>
                                    <div className='top-tags-cells'>
                                        <div className='top-cell'>
                                            <div className='tag-cell bg-black-025'>
                                                <Link className='s-tag s-tag__lg' to='/tags/java'>
                                                    java
                                                </Link>
                                                <div className='score'>
                                                    <div className='score-txt'>
                                                        <div className='score-tab'>
                                                            <span className='txt fc-light'>Posts</span>
                                                            <span className='number fc-black-800'>2</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className='top-tags-cells'>
                                        <div className='top-cell'>
                                            <div className='tag-cell bg-black-025'>
                                                <Link className='s-tag s-tag__md' to='/tags/node.js'>
                                                    node.js
                                                </Link>
                                                <div className='score'>
                                                    <div className='score-txt'>
                                                        <div className='score-tab'>
                                                            <span className='txt fc-light'>Posts</span>
                                                            <span className='number fc-black-800'>1</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className='top-tags-cells'>
                                        <div className='top-cell'>
                                            <div className='tag-cell bg-black-025'>
                                                <Link className='s-tag s-tag__md' to='/tags/react'>
                                                    react
                                                </Link>
                                                <div className='score'>
                                                    <div className='score-txt'>
                                                        <div className='score-tab'>
                                                            <span className='txt fc-light'>Posts</span>
                                                            <span className='number fc-black-800'>0</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <RightSideBar/>
            </div>
        </div>
    </Fragment>
};


export default UserPage;
