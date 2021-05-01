import express from 'express'
import http from 'http'
import cookieParser from 'cookie-parser'
import session from 'express-session'
import MongoStore from 'connect-mongo'

const app = express()
app.use(cookieParser())
app.use(session({
    store: MongoStore.create({ 
        //En Atlas connect App: Make sure to change the node version to 2.2.12:
        mongoUrl: 'mongodb+srv://Eggel:coderhouse@cluster0.iazms.mongodb.net/ecommerce?retryWrites=true&w=majority',
        //mongoOptions: { useNewUrlParser: true, useUnifiedTopology: true },
        ttl: 600
    }),
    secret: 'shhhhhhhhhhhhhhhhhhhhh',
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
        maxAge: 600000
    }
}))



const getNombreSession = req => req.session.nombre? req.session.nombre: ''

const server = http.Server(app)

import { Server as Socket } from 'socket.io'
const io = new Socket(server)

import handlebars from 'express-handlebars'
import Productos from './api/productos.js'
import Mensajes from './api/mensajes.js'
import { MongoDB } from './db/db.js'

let productos = new Productos()
let mensajes = new Mensajes()

import { getProdRandom } from './generador/productos.js'

//--------------------------------------------
//establecemos la configuración de handlebars
app.engine(
    "hbs",
    handlebars({
      extname: ".hbs",
      defaultLayout: 'index.hbs',
    })
);
app.set("view engine", "hbs");
app.set("views", "./views");
//--------------------------------------------

app.use(express.static('public'))

/* -------------------------------------------------------- */
/* -------------- LOGIN y LOGOUT DE USUARIO --------------- */
/* -------------------------------------------------------- */
app.use(express.urlencoded({extended: true}))

/* --------- LOGIN ---------- */
app.get('/login', (req,res) => {
  if(req.session.nombre) {
      res.render("home", {
          nombre: req.session.nombre
      })
  }
  else {
      res.sendFile(process.cwd() + '/public/login.html')
  }
})
app.post('/login', (req,res) => {
  let { nombre } = req.body
  req.session.nombre = nombre
  res.redirect('/')
})

app.get('/logout', (req,res) => {
  let nombre = getNombreSession(req)
  if(nombre) {
      req.session.destroy( err => {
          if(!err) res.render("logout", { nombre })
          else res.redirect('/')
      })
  }
  else {
      res.redirect('/')
  }
})

/* -------------------------------------------------------- */
/* -------------------------------------------------------- */
/* -------------------------------------------------------- */

const router = express.Router()
app.use('/api', router)

router.use(express.json())
router.use(express.urlencoded({extended: true}))


router.get('/productos/listar', async (req,res) => {
    res.json(await productos.listarAll())
})

router.get('/productos/listar/:id', async (req,res) => {
    let { id } = req.params
    res.json(await productos.listar(id))
})

router.post('/productos/guardar', async (req,res) => {
    let producto = req.body
    await productos.guardar(producto)
    res.json(producto)
    //res.redirect('/')
})

router.put('/productos/actualizar/:id', async (req,res) => {
    let { id } = req.params
    let producto = req.body
    await productos.actualizar(producto,id)
    res.json(producto)
})

router.delete('/productos/borrar/:id', async (req,res) => {
    let { id } = req.params
    let producto = await productos.borrar(id)
    res.json(producto)
})

router.get('/productos/vista', async (req, res) => {
    let prods = await productos.listarAll()

    res.render("vista", {
        productos: prods,
        hayProductos: prods.length
    })
})

router.get('/productos/vista-test', async (req, res) => {

    let cant = req.query.cant || 10
    let prods = []
    for(let i=0; i<cant; i++) prods.push(getProdRandom(i+1))

    //console.log(prods)
    res.render("vista", {
        productos: prods,
        hayProductos: prods.length
    })
})

/* -------------------- Web Sockets ---------------------- */
io.on('connection', async socket => {
    console.log('Nuevo cliente conectado!');
    
    /* ------------------- */
    /* Info Productos (ws) */
    /* ------------------- */
    /* Envio los mensajes al cliente que se conectó */
    socket.emit('productos', await productos.get());

    /* Escucho los mensajes enviado por el cliente y se los propago a todos */
    socket.on('update', async data => {
        if(data = 'ok') {
            io.sockets.emit('productos',  await productos.get()); 
        }
    })

    /* ----------------------- */
    /* Centro de mensajes (ws) */
    /* ----------------------- */
    socket.emit('messages', await mensajes.getAll());

    socket.on('new-message', async function(data) {
        //console.log(data)
        await mensajes.guardar(data); 
        io.sockets.emit('messages', await mensajes.getAll()); 
    })    
});
/* ------------------------------------------------------- */
const PORT = process.env.PORT || 8080;
const srv = server.listen(PORT, async () => {
    console.log(`Servidor http escuchando en el puerto ${srv.address().port}`)
    try {
        const mongo = new MongoDB('mongodb+srv://Eggel:coderhouse@cluster0.iazms.mongodb.net/ecommerce?retryWrites=true&w=majority')
        await mongo.conectar()
        console.log('base MongoDB conectada')
    }
    catch(error) {
        console.log(`Error en conexión de Base de datos: ${error}`)
    }
})
srv.on("error", error => console.log(`Error en servidor ${error}`))
