import Helper as H
import time

from diffusers import StableDiffusionPipeline
from diffusers import DDPMScheduler
import torch
from PIL import Image
import random
from diffusers import StableDiffusionInpaintPipeline
#DO NOT PUSH THIS TOKEN
token = "Your Token"

def GenImg(text,image,mask,steps,callback,guidance_scale):
    pipe = StableDiffusionInpaintPipeline.from_pretrained("stabilityai/stable-diffusion-2-inpainting", torch_dtype=torch.bfloat16,token=token)
    pipe = pipe.to("cuda")

    images = pipe(prompt=text,image=image,num_inference_steps=steps,mask_image=mask).images
    

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

    mycall = lambda p,x,y,z : TellUser(ws,p,x,steps,y,z)
    last_images = H.GetMessageFiles(chat,messages[-1])
    if(len(last_images) <= 0) :
        H.SendChat(chat,date,"Missing Images",files=[])
        H.GetFrom(ws,date)
        H.Update(ws,"returning early")
        return


    width, height = last_images[0].size
    # Create a new white image with the same dimensions
    white_pill_image = Image.new('RGB', (width, height), (255, 255, 255))

    if(len(last_images) > 1):
        white_pill_image = last_images[1]


    images = GenImg(text,last_images[0],white_pill_image,steps,mycall,guidance_scale)
    


    H.SendChat(chat,date,"",files=images)

    H.GetFrom(ws,date)    
    H.Update(ws,"done generating message, closing")


    print("closing")



if __name__ == '__main__':
    H.Loop(Main)