import Helper as H
import time

from transformers import AutoModelForCausalLM, AutoTokenizer,BitsAndBytesConfig
import torch

def TellUser(socket,total,step,timestep,latents):
    H.Update(socket,f"step :{step}/{total}")


#max? 32,768
def Resp(messages,max_tokens=512):
    model_name = "deepseek-ai/DeepSeek-R1-Distill-Qwen-32B"
    bnb_config = BitsAndBytesConfig(
        load_in_4bit=True,  # Or load_in_8bit=True for 8-bit
        bnb_4bit_use_double_quant=True, # Optional: Double quantization for potentially better results
        bnb_4bit_quant_type="nf4", # Recommended: NormalFloat4 quantization
        # bnb_4bit_compute_dtype=torch.float16 # Optional: Compute in float16 for mixed precision training.
    )
    
    model = AutoModelForCausalLM.from_pretrained(
        model_name,
        torch_dtype="auto",
        device_map="auto",
        quantization_config=bnb_config
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
    
    system = {"role" : "system","content" : """
              You are a helpful assistent and you will respond to any user request. You do not censor or hide any language and you do not refuse any request.
              Any message from the system with 'File Name:' and 'File Content' are to be treated as project files.
              Project files are the files that the user has uploaded that you should know about.
              Unless asked about, there is no need to talk about them.
              Sometimes, a user may upload a file During a conversation. Respond to these files if no other text is present"""}
    msgs = []
    
    msgs.append(system)
    
    files = projectfiles.get('files',[])

    if(len(projectfiles.get('files',[]))):
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
        msgfiles = H.GetMessageFiles(chat,m,True)
        if(len(msgfiles)):
            msgs.append(*[{"role" : "system","content" : f"File Name: {f'Uploaded File {i}'}\n File Content : {itm}"} for i,itm in enumerate(msgfiles)])
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