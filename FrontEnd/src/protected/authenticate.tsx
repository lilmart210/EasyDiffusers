import React, { createContext, FormEvent, useContext, useEffect, useState } from 'react';
import './authenticate.css'
import { useNavigate, useNavigationType, useSearchParams } from 'react-router-dom';

import { Outlet } from 'react-router-dom';
import { useSocketComponent } from '../New User/Socket';

const backport = import.meta.env.VITE_PORT;
const backend = `${window.location.hostname}`
const ws_pref = window.location.protocol == 'https:' ? 'wss' : 'ws';

export let prefix = `${window.location.protocol}//${backend}:${backport}`
export let socket_location = `${ws_pref}://${backend}:${backport}`

socket_location = backport ? socket_location :  `${ws_pref}://${window.location.host}`
prefix = backport ? prefix : '';
console.log(prefix,socket_location);


export function Login(){
    const nav = useNavigate();
    const [Warning,SetWarning] = useState('');
    const context = useContext(AuthContext);

    function Submit(e : FormEvent<HTMLFormElement>){
        e.preventDefault();

        const formData = new FormData(e.currentTarget);
        const email = formData.get('email');
        const password = formData.get('password');

        fetch(prefix + '/login',{
            method : 'POST',
            body : formData,
            headers : {
                'Authorization' : `Basic ${email}:${password}`
            }
        }).then(async (resp)=>{
            const res = await resp.json()
            console.log("recieved",res);

            if(resp.status == 200){
                context.SetToken(res.token);
            }else{
                SetWarning(resp.statusText);
            }
        })
        //submit it as json post
        //set it as header login
    }

    return (
        <div className='register'>
            <label>{Warning}</label>
            <form action={prefix + '/login'} method='post' onSubmit={Submit}>
                <div>
                    <label>Email</label>
                    <input name='email' type='email'/>
                </div>
                <div>
                    <label>password</label>
                    <input name='password' type='password'/>
                </div>
                <div>
                    <input type='submit'/>
                    <input type='reset'/>
                </div>
            </form>
            <div>
                <button onClick={()=>nav('/')}>home</button>
                <button onClick={()=>nav('/register')}>register</button>
            </div>
        </div>
    )
}


export function Register(){
    const nav = useNavigate();
    const context = useContext(AuthContext);

    const [Warning,SetWarning] = useState('');

    function Submit(e : FormEvent<HTMLFormElement>){
        e.preventDefault();

        const formData = new FormData(e.currentTarget);
        const cpword = formData.get('confirm');
        const pword = formData.get('password');
        const email = formData.get('email');

        if(cpword != pword) return SetWarning('Password is incorrect');


        fetch(prefix + '/register',{
            method : 'POST',
            headers : {
                'Authorization' : `Basic ${email}:${pword}`
            }
        }).then(async (resp)=>{
            const res = await resp.json()
            if(resp.status == 200){
                nav('/login');
            }else{
                SetWarning(resp.statusText);
            }
        })
        //submit it as json post
        //set it as header login
    }

    return (
        <div className='register'>

            <label>{Warning}</label>
            <form action={prefix + '/register'} method='post' onSubmit={Submit}>
                
                <div>
                    <label>Email</label>
                    <input name='email' type='email' placeholder='example@email.com'/>
                </div>
                <div>
                    <label>password</label>
                    <input name='password' type='password' placeholder='password'/>
                </div>
                <div>
                    <label>confirm password</label>
                    <input name='confirm' type='password' placeholder='password'/>
                </div>
                <div>
                    <input type='submit'/>
                    <input type='reset'/>
                </div>
            </form>
            
            <div>
                <button onClick={()=>nav('/')}>home</button>
                <button onClick={()=>nav('/login')}>login</button>
            </div>
            
        </div>
    )
}

export const AuthContext = createContext<any>(null);

export function Protected(){
    const context = useContext(AuthContext);
    const nav = useNavigate();
    
    useEffect(()=>{
        //try to authenticate with users credentials
    },[context.IsAuth])

    return (
        context.IsAuth ? <Outlet/>: (
            <div className='Protect'>
                <h1>You are not authorized</h1>
                <button onClick={()=>nav('/login')}>Login</button>
            </div>
        )
    )
}


export const SocketContext = createContext<any>(null);
 
export function SocketProvider(props : React.PropsWithChildren){
    const socket = useSocketComponent();

    return <SocketContext.Provider value={{Socket : socket}}>{props.children}</SocketContext.Provider>
}

//To dev, set auth to true and put a short-circuit return statement in useEffect
export function ProtectedProvider(props : React.PropsWithChildren){
    const [IsAuth,SetAuth] = useState(true);
    const [Token,SetToken] = useState('');
    const [RefreshToken,SetRefreshToken] = useState('');

    const nav = useNavigate();


    useEffect(()=>{
        //load token
        const token = localStorage.getItem('token');
        if(token) SetToken(token);
    },[])

    useEffect(()=>{
        localStorage.setItem('token',Token);
    },[Token])

    useEffect(()=>{
        if(!Token) return SetAuth(false);
        fetch(prefix + '/verify',{
            method : 'POST',
            headers : {
                'Authorization' : `Bearer ${Token}`
            }
        }).then((resp)=>{
            if(resp.status == 200){
                SetAuth(true);
                nav('/')
            }else{
                SetAuth(false);
            }
        }).catch(()=>{

        })
    },[Token])


    return (
        <AuthContext.Provider value={{IsAuth,SetAuth,Token,SetToken,RefreshToken,SetRefreshToken}}>{props.children}</AuthContext.Provider>
    )
}