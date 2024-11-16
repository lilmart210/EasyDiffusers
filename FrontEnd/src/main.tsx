import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { Login,Protected,ProtectedProvider,Register } from './protected/authenticate.tsx'
import { UserInterface } from './userinterface/user.tsx'


ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <BrowserRouter>
      <ProtectedProvider>
        <Routes>
            <Route path='/' element={<Protected/>}>
              <Route path='/' element={<UserInterface/>}/>
            </Route>
            <Route path='/login' element={<Login></Login>}/>
            <Route path='/register' element={<Register></Register>}/>
        </Routes>
      </ProtectedProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
