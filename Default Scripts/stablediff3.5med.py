import Helper as H
import time

from diffusers import StableDiffusionPipeline
from diffusers import DDPMScheduler
import torch
import random
from diffusers import StableDiffusion3Pipeline
token = "YOUR TOKEN"

def GenImg(text,negatives,steps,height,width,callback,guidance_scale):
    pipe = StableDiffusion3Pipeline.from_pretrained("stabilityai/stable-diffusion-3.5-medium", torch_dtype=torch.bfloat16)
    pipe = pipe.to("cuda")

    images = pipe(text,width=width,height=height,num_inference_steps=steps,guidance_scale=guidance_scale).images
    

    return images

def TellUser(socket,total,step,timestep,latents):
    H.Update(socket,f"step :{step}/{total}")

def Main(ws,messages : list,chat : int,params : dict,files : list):
    """
        params is in key value format
        documentation is in helper.py
    """    
    #parameters for the chat
    steps = params.get("steps",20)
    height = int(params.get("height",512))
    width = int(params.get("width",512))
    negatives = params.get("negatives","")
    guidance_scale = params.get("guidance scale",4.5)

    last = messages[-1]["msg"]["text"]
    text = last

    #current time in ms
    date = H.Time()
    

    H.Update(ws,"generating message")

    mycall = lambda x,y,z : TellUser(ws,steps,x,y,z)

    images = GenImg(text,negatives,steps,height,width,mycall,guidance_scale)
    
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