import Helper as H
import time

from diffusers import StableDiffusionPipeline
from diffusers import DDPMScheduler
import torch
from PIL import Image
import random
from diffusers import StableDiffusionInpaintPipeline
from diffusers import LTXImageToVideoPipeline,LTXPipeline
from diffusers.utils import export_to_video, load_image


def GenImg(text,image,steps,callback,guidance_scale,negatives,width,height,frames,frame_count,offload):
    
    if(image != None):
        pipe = LTXImageToVideoPipeline.from_pretrained("Lightricks/LTX-Video", torch_dtype=torch.bfloat16)
        if(offload):
            pipe.enable_sequential_cpu_offload()
        video = pipe(
            image=image,
            prompt=text,
            negative_prompt=negatives,
            width=width,
            height=height,
            num_frames=frame_count,
            num_inference_steps=steps,
            guidance_scale = guidance_scale,
        ).frames
    else:
        pipe = LTXPipeline.from_pretrained("Lightricks/LTX-Video", torch_dtype=torch.bfloat16)
        pipe.to("cuda")
        if(offload):
            pipe.enable_sequential_cpu_offload()
        video = pipe(
            prompt=text,
            negative_prompt=negatives,
            width=width,
            height=height,
            num_frames=frame_count,
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
    height = int(params.get("height",512))
    width = int(params.get("width",512))
    negatives = params.get("negatives","")
    guidance_scale = params.get("guidance scale",4.5)
    frames = params.get("fps",24)
    frame_count = params.get("frames",120) #5 second video
    offload = params.get("offload",False)

    last = messages[-1]["msg"]["text"]
    text = last

    #current time in ms
    date = H.Time()
    

    H.Update(ws,"generating message")

    mycall = lambda p,x,y,z : TellUser(ws,p,x,steps,y,z)
    last_images = H.GetMessageFiles(chat,messages[-1])
    
    img = last_images[0] if len(last_images) > 0 else None 
    if(len(last_images)):
        img = last_images[0]
        width,height = img.size

    vids = GenImg(text,img,steps,mycall,guidance_scale,negatives,width,height,frames,frame_count,offload)
    

    H.SendChat(chat,date,"",files=vids,fps=frames,videos=True)

    H.GetFrom(ws,date)    
    H.Update(ws,"done generating message, closing")


    print("closing")



if __name__ == '__main__':
    H.Loop(Main)