import React, { memo } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
//import './index.css'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { Login,Protected,ProtectedProvider,Register, SocketProvider } from './protected/authenticate.tsx'
//import { UserInterface } from './userinterface/user.tsx'
import { Collage } from './New User/Collage.tsx'

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <BrowserRouter>
      <ProtectedProvider>
        <SocketProvider>
          <Routes>
              <Route path='/' element={<Protected/>}>
                <Route path='/' element={<Collage/>}/>
              </Route>
              <Route path='/login' element={<Login></Login>}/>
              <Route path='/register' element={<Register></Register>}/>
          </Routes>
        </SocketProvider>
      </ProtectedProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
