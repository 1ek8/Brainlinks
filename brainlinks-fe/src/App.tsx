
import Dashboard from './pages/Dashboard'
import { Signin } from './pages/Signin'
import { Signup } from './pages/Signup' 
import { SharedBrain } from './pages/SharedBrain'

import { BrowserRouter, Routes, Route } from 'react-router-dom'

function App() {
  return <>
    <BrowserRouter>
      <Routes>
        <Route path = "/signup" element = {<Signup/>} />
        <Route path = "/signin" element = {<Signin/>} />
        <Route path = "/dashboard" element = {<Dashboard/>} />
        <Route path = "/brain/:hash" element = {<SharedBrain/>} />
      </Routes>
    </BrowserRouter>

  </> 
}

export default App
