const fs = require('fs');
const path = require('path');

const req = path.join(__dirname,'requirements.txt');
const reqraw = path.join(__dirname,'requirements_raw.txt');

const text = fs.readFileSync(reqraw,{encoding : 'utf-8'});

const rep = text.replaceAll('==','>=');

fs.writeFileSync(req,rep,{encoding : 'utf-8'});