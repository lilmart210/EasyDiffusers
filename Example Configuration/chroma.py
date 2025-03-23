import Helper as H
import time

from diffusers import StableDiffusionPipeline
from diffusers import DDPMScheduler
import torch
import random
from datasets import load_dataset

#ds = load_dataset("gsdf/EasyNegative")

def GenImg(text,negatives,steps,height,width,callback,count):
    mid = '../Cache/chroma/Chroma/chroma_011-mid_1330309-vid_1501971.safetensors'
    model = StableDiffusionPipeline.from_single_file(mid,use_safetensors=True,torch_dtype=torch.float16).to('cuda')
    #model.load_textual_inversion('embed/EasyNegative')
    #model.scheduler = DDPMScheduler.from_config(model.scheduler.config)
    
    high_noise_frac = 0.8

    images = model(text,negative_prompt=negatives,num_inference_steps=steps,height=height,width=width,denoising_end=high_noise_frac,callback_on_step_end=callback,num_images_per_prompt=count).images
    return images

def TellUser(socket,pipe,step,total,stepleft,kwargs):
    H.Update(socket,f"step :{step}/{total}")
    
    return kwargs

def Main(ws,messages : list,chat : int,params : dict,projectfiles : list):
    """
        params is in key value format
        documentation is in helper.py
    """    
    #parameters for the chat
    negatives = params.get("negatives","")
    steps = int(params.get("steps",20))
    height = int(params.get("height",512))
    width = int(params.get("width",512))
    count = int(params.get("count",1))

    last = messages[-1]["msg"]["text"]
    text = last

    #current time in ms
    date = H.Time()
    

    H.Update(ws,"generating message")

    mycall = lambda p,x,y,z : TellUser(ws,p,x,steps,y,z)

    images = GenImg(text,negatives,steps,height,width,mycall,count)


    H.SendChat(chat,date,'',files=images)

    H.GetFrom(ws,date)    
    H.Update(ws,"done generating message, closing")


    print("closing")



if __name__ == '__main__':
    H.Loop(Main)