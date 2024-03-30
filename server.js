// const https = require('https');
// import https from 'https';

// <link rel="manifest" href="/manifest.webmanifest"><script id="vite-plugin-pwa:register-sw" src="/registerSW.js"></script></head>

import express from 'express';
import fs from 'node:fs/promises';
import newFs from 'node:fs';
import path, { dirname } from 'node:path';



// COUNT JSON FILES
// ========================================
if (!global.hasOwnProperty('__dirname')) {
  global.__dirname = path.resolve(path.dirname(''));
}

let manifestCount;

function countJSONFiles(directoryPath, callback) {
  newFs.readdir(directoryPath, (err, files) => {
      if (err) {
          console.error('Error:', err);
          callback(err);
          return;
      }

      let jsonFileCount = 0;

      files.forEach(file => {
          const filePath = path.join(directoryPath, file);
          if (newFs.statSync(filePath).isFile() && path.extname(filePath) === '.json') {
              jsonFileCount++;
          }
      });

      manifestCount = jsonFileCount;

      callback(null, jsonFileCount);
  });
}

const publicFolderPath = path.join(__dirname, 'public');

manifestCount = countJSONFiles(publicFolderPath, (err, count) => {

    if (err) {
        console.error('Error:', err);
        return;
    }
    console.log('Número de archivos .json en la carpeta /public:', count);
    return count;
});

// Constants
const isProduction = process.env.NODE_ENV === 'production'
const options = {
  key: newFs.readFileSync('./localhost-key.pem'),
  cert: newFs.readFileSync('./localhost.pem')
}
const port = process.env.PORT || 5173
const base = process.env.BASE || '/'

// Cached production assets
const templateHtml = isProduction
  ? await fs.readFile('./dist/client/index.html', 'utf-8')
  : ''
const ssrManifest = isProduction
  ? await fs.readFile('./dist/client/.vite/ssr-manifest.json', 'utf-8')
  : undefined

// Create http server
const app = express()

// Add Vite or respective production middlewares
let vite
if (!isProduction) {
  const { createServer } = await import('vite')
  vite = await createServer({
    server: { middlewareMode: true },
    appType: 'custom',
    base
  })
  app.use(vite.middlewares)
} else {
  const compression = (await import('compression')).default
  const sirv = (await import('sirv')).default
  app.use(compression())
  app.use(base, sirv('./dist/client', { extensions: [] }))
}

app.use(express.static('public'));
// Serve HTML
app.use('*', async (req, res) => {
  try {
    const url = req.originalUrl.replace(base, '');
    console.log('url: ', url);

    const content = `{
      "short_name": "MFine",
      "name": "MFine",
      "icons": [
        {
          "src": "/public/download.png",
          "type": "image/png",
          "sizes": "64x64"
        },
        {
          "src": "/images/appIcons/icons-512.png",
          "type": "image/png",
          "sizes": "512x512"
        }  
      ],
      "start_url": "/",
      "background_color": "#273e75",
      "display": "standalone",
      "theme_color": "#ffffff",
      "orientation": "portrait"
    }`;

    await newFs.writeFile(`./public/manifest-${url.replace('/', '-')}.json`, JSON.stringify(content), 'utf-8', err => {
      if (err) {
        console.error(err);
      } else {
        // file written successfully
      }
    });

    manifestCount = countJSONFiles(publicFolderPath, (err, count) => {
      if (err) {
          console.error('Error:', err);
          return;
      }
      console.log('Número de archivos .json en la carpeta /public:', count);
      return count;
    });

    let template
    let render
    if (!isProduction) {
      // Always read fresh template in development
      template = await fs.readFile('./index.html', 'utf-8')
      template = await vite.transformIndexHtml(url, template)
      render = (await vite.ssrLoadModule('/src/entry-server.jsx')).render
    } else {
      template = templateHtml
      render = (await import('./dist/server/entry-server.js')).render
    }

    const rendered = await render(url, ssrManifest)

    const html = template
      .replace(`<!--app-head-->`, rendered.head ?? '')
      .replace(`<!--app-html-->`, rendered.html ?? '')

    // res.status(200).set({ 'Content-Type': 'text/html' }).send(html)

    res.status(200).set({ 'Content-Type': 'text/html' }).send(`<h1>JsonFiles COUNTER: ${manifestCount}</h1>`)
  } catch (e) {
    vite?.ssrFixStacktrace(e)
    console.log(e.stack)
    res.status(500).end(e.stack)
  }
});

// Start http server
app.listen(port, () => {
  console.log(`Server started at http://localhost:${port}`)
})

// https.createServer(options, app)
//   .listen(port, function (req, res) {                               //Change Port Number here (if required, 443 is the standard port for https)
//     console.log(`Server started at http://localhost:${port}`);      //and here
//   });
