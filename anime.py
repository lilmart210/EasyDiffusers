import Helper as H
import time

from diffusers import StableDiffusionPipeline
from diffusers import DDPMScheduler
import torch
import random

def GenImg(text,negatives,steps,height,width,callback):
    mid = 'gsdf/Counterfeit-V2.5'
    model = StableDiffusionPipeline.from_pretrained(mid,torch_dtype=torch.float16).to('cuda')
    model.scheduler = DDPMScheduler.from_config(model.scheduler.config)
    high_noise_frac = 0.8

    images = model(text,negative_prompt=negatives,num_inference_steps=steps,height=height,width=width,denoising_end=high_noise_frac,callback=callback,callback_steps = 1).images
    return images

def TellUser(socket,total,step,timestep,latents):
    H.Update(socket,f"step :{step}/{total}")

def Main(ws,messages : list,chat : int,params : dict,files : list):
    """
        params is in key value format
        documentation is in helper.py
    """    
    #parameters for the chat
    negatives = params.get("negatives","")
    steps = int(params.get("steps",20))
    height = int(params.get("height",512))
    width = int(params.get("width",512))
    
    last = messages[-1]["msg"]["text"]
    text = last

    #current time in ms
    date = H.Time()
    

    H.Update(ws,"generating message")

    mycall = lambda x,y,z : TellUser(ws,steps,x,y,z)

    images = GenImg(text,negatives,steps,height,width,mycall)
    
    #random text from project files if is there
    rt = ""

    if(len(files)):
        sp = files[0]["text"].split(' ')
        rt = files[0]["name"] + " "+sp[random.randint(0,len(sp) - 1)]


    H.SendChat(chat,date,rt,images)

    H.GetFrom(ws,date)    
    H.Update(ws,"done generating message, closing")


    print("closing")



if __name__ == '__main__':
    H.Loop(Main)