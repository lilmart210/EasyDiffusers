import Helper as H
import time

from transformers import AutoModelForCausalLM, AutoTokenizer
import torch

def TellUser(socket,total,step,timestep,latents):
    H.Update(socket,f"step :{step}/{total}")


#max? 32,768
def Resp(messages,max_tokens=512):
    model_name = "Qwen/Qwen2.5-7B-Instruct"

    model = AutoModelForCausalLM.from_pretrained(
        model_name,
        torch_dtype="auto",
        device_map="cuda"
    )
    tokenizer = AutoTokenizer.from_pretrained(model_name)

    text = tokenizer.apply_chat_template(
        messages,
        tokenize=False,
        #documents = documents,
        #chat_template="rag",
        add_generation_prompt=True
    )

    model_inputs = tokenizer([text], return_tensors="pt").to(model.device)

    generated_ids = model.generate(
        **model_inputs,
        max_new_tokens=max_tokens,
        
    )
    generated_ids = [
        output_ids[len(input_ids):] for input_ids, output_ids in zip(model_inputs.input_ids, generated_ids)
    ]

    response = tokenizer.batch_decode(generated_ids, skip_special_tokens=True)[0]
    return response

def GetRole(role : str):
    if(role == 'ai'):
        return 'assistant'
    return role

def Main(ws,messages : list,chat : int,params : dict,projectfiles : dict):

    H.Update(ws,"Creating Messages")
    max_tokens = params.get("tokens",512)
    
    system = {"role" : "system","content" : "Any message from the system with 'File Name:' and 'File Content' are to be treated as project files. Project files are the files that the user has uploaded that you should know about. Unless asked about, there is no need to talk about them"}
    msgs = []
    
    msgs.append(system)
    
    files = projectfiles.get('files',[])

    if(len(projectfiles)):
        f1 = projectfiles.get('name')
        msgs.append({"role" : "system", "content" : f"The name of the working project is '{f1}'"})
    
    docs = [{"role" : "system","content" : f"File Name: {afile['name']}\n File Content : {afile['text']}"} for afile in files]
    msgs.extend(docs)
    
    for x in range(len(messages)):
        #iterate over files
        m = messages[x]
        chatm = m["msg"]
        #does nothing just yet...
        #msgfiles = H.GetMessageFiles(chat,m)
        
        u = {"role" : GetRole(chatm.get('role','user')),"content" : chatm["text"]}
        msgs.append(u)
    
    
    H.Update(ws,"Thinking...")
    text = Resp(msgs,max_tokens)
    H.Update(ws,"Sending Resposne...")

    date = H.Time()
    
    H.SendChat(chat,date,text)

    H.GetFrom(ws,date)
    H.Update(ws,"done")

if __name__ == '__main__':
    H.Loop(Main)