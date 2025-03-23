import Helper as H
import time

from diffusers import StableDiffusionPipeline
from diffusers import DDPMScheduler
import torch
from PIL import Image
import random
from diffusers import StableDiffusionInpaintPipeline
from diffusers import CogVideoXImageToVideoPipeline
from diffusers.utils import export_to_video, load_image


def GenImg(text,image,steps,callback,guidance_scale,negatives,frames,count,offload):
    
    pipe = CogVideoXImageToVideoPipeline.from_pretrained("THUDM/CogVideoX-5b-I2V", torch_dtype=torch.bfloat16)
    if(offload):
        pipe.enable_sequential_cpu_offload()
        pipe.vae.enable_tiling()
        pipe.vae.enable_slicing()

    video = pipe(
        image=image,
        prompt=text,
        negative_prompt=negatives,
        num_videos_per_prompt=count,
        num_inference_steps=steps,
        guidance_scale = guidance_scale,
    ).frames

    return video

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
    negatives = params.get("negatives","")
    guidance_scale = params.get("guidance scale",4.5)
    frames = params.get("fps",24)
    count = params.get("count",1)
    offload = params.get("offload",False)

    last = messages[-1]["msg"]["text"]
    text = last

    #current time in ms
    date = H.Time()
    

    H.Update(ws,"generating message")

    mycall = lambda p,x,y,z : TellUser(ws,p,x,steps,y,z)
    last_images = H.GetMessageFiles(chat,messages[-1])
    
    img = last_images[0] if len(last_images) > 0 else None 

    if(len(last_images) < 1):
        H.SendChat(chat,date,"",files=[])
        H.GetFrom(ws,date)    
        H.Update(ws,"Missing Images")
        return 

    vids = GenImg(text,img,steps,mycall,guidance_scale,negatives,frames,count,offload)
    

    H.SendChat(chat,date,"",files=vids,fps=frames,videos=True)

    H.GetFrom(ws,date)    
    H.Update(ws,"done generating message, closing")


    print("closing")



if __name__ == '__main__':
    H.Loop(Main)