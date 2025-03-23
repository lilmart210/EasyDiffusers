import Helper as H
import time

from diffusers import StableDiffusionPipeline
from diffusers import DDPMScheduler
import torch
import random
from diffusers import FluxPipeline,BitsAndBytesConfig
#DO NOT PUSH THIS TOKEN
token = "Your Token"


def GenImg2(text,negatives,steps,height,width,callback,guidance_scale,count,nsfw):
    model_id = "stabilityai/stable-diffusion-3.5-large"

    nf4_config = BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_quant_type="nf4",
        bnb_4bit_compute_dtype=torch.bfloat16
    )
    model_nf4 = SD3Transformer2DModel.from_pretrained(
        model_id,
        subfolder="transformer",
        quantization_config=nf4_config,
        torch_dtype=torch.bfloat16
    )

    pipeline = StableDiffusion3Pipeline.from_pretrained(
        model_id, 
        transformer=model_nf4,
        torch_dtype=torch.bfloat16
    )
    pipeline.enable_model_cpu_offload()
    
    if(nsfw):
        pipe.load_lora_weights("lustlyai/Flux_Lustly.ai_Uncensored_nsfw_v1",
                           weight_name="flux_lustly-ai_v1.safetensors",
                           adapter_name="v1")

        pipe.set_adapters(["v1"], adapter_weights=[1])
    
    images = pipe(text,width=width,height=height,num_inference_steps=steps,guidance_scale=guidance_scale,num_images_per_prompt=count).images
    

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
    count = params.get("count",1)
    nsfw = params.get('nsfw',False)

    last = messages[-1]["msg"]["text"]
    text = last

    #current time in ms
    date = H.Time()
    

    H.Update(ws,"generating message")

    mycall = lambda p,x,y,z : TellUser(ws,p,x,steps,y,z)

    images = GenImg(text,negatives,steps,height,width,mycall,guidance_scale,count,nsfw)
    


    H.SendChat(chat,date,"",files=images)

    H.GetFrom(ws,date)    
    H.Update(ws,"done generating message, closing")


    print("closing")



if __name__ == '__main__':
    H.Loop(Main)