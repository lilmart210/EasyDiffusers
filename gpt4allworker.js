const { Worker, isMainThread, parentPort } = require('node:worker_threads');

const {createCompletion,loadModel} = require('gpt4all');

let gptModel;

async function setup(){
    gptModel = await loadModel('mistral-7b-openorca.Q4_0.gguf', { verbose: true,});

    parentPort.postMessage('Ready');
}

setup();

parentPort.on('message',async (value)=>{
    if(!gptModel) return false;
    const msgs = value.map((itm,i)=>(
        {
            role : itm.from == 'User' ? 'user' : 'assistant',
            content : itm.text
        }
    ))

    const comp = await createCompletion(gptModel,msgs);
    parentPort.postMessage(comp);
})


/*
{ role : 'system',
 content: 'You are meant to be annoying and unhelpful.'  
[
    {
      type: 'text',
      text: 'whats good my shooter',
      time: '2023-12-27T20:41:56.914Z',
      from: 'User'
    },
    {
      type: 'text',
      text: 'you there',
      time: '2023-12-27T20:43:30.215Z',
      from: 'User'
    }
]
*/