import Helper as H
import time

from diffusers import StableDiffusionPipeline
from diffusers import DDPMScheduler
import torch
import random
from diffusers import FluxPipeline
#DO NOT PUSH THIS TOKEN
token = "Your Token"
from diffusers import FluxPipeline, AutoencoderKL, FluxTransformer2DModel
from diffusers.image_processor import VaeImageProcessor 
import torch 
import gc 

def GenImg(text,negatives,steps,height,width,callback,guidance_scale,count,nsfw):
    pipe = FluxPipeline.from_pretrained("black-forest-labs/FLUX.1-dev", torch_dtype=torch.bfloat16,token=token,device_map='balanced')

    pipe.enable_model_cpu_offload()
    pipe.vae.enable_tiling()
    pipe.vae.enable_slicing()

    pipe = pipe.to("cuda")

    images = pipe(text,width=width,height=height,num_inference_steps=steps,guidance_scale=guidance_scale,num_images_per_prompt=count).images
    return images

def GenImg2(text,negatives,steps,height,width,callback,guidance_scale,count,nsfw):
    
    def flush():
        gc.collect()
        torch.cuda.empty_cache()
        torch.cuda.reset_max_memory_allocated()
        torch.cuda.reset_peak_memory_stats()

    ckpt_id = "black-forest-labs/FLUX.1-dev"

    # Initialize pipeline with balanced device map and CPU offload
    pipeline = FluxPipeline.from_pretrained(
        ckpt_id,
        transformer=None,
        vae=None,
        device_map="balanced",
        max_memory={0: "24GB", 1: "24GB"},
        torch_dtype=torch.bfloat16
    )
    #pipeline.enable_model_cpu_offload()

    print(pipeline.hf_device_map)

    # Encode prompts
    with torch.no_grad():
        print("Encoding prompts.")
        prompt_embeds, pooled_prompt_embeds, text_ids = pipeline.encode_prompt(
            prompt=text, max_sequence_length=512,prompt_2 = None
        )
    print(prompt_embeds.shape)

    # Clean up encoders
    del pipeline.text_encoder
    del pipeline.text_encoder_2
    del pipeline.tokenizer
    del pipeline.tokenizer_2
    del pipeline
    flush()

    # Load transformer with device map
    transformer = FluxTransformer2DModel.from_pretrained(
        ckpt_id, 
        subfolder="transformer",
        device_map="auto",
        torch_dtype=torch.bfloat16
    )
    print(transformer.hf_device_map)

    # Reinitialize pipeline with transformer
    pipeline = FluxPipeline.from_pretrained(
        ckpt_id,
        text_encoder=None,
        text_encoder_2=None,
        tokenizer=None,
        tokenizer_2=None,
        vae=None,
        transformer=transformer,
        torch_dtype=torch.bfloat16
    )
    #pipeline.enable_model_cpu_offload()

    print("Running denoising.")
    latents = pipeline(
        prompt_embeds=prompt_embeds,
        pooled_prompt_embeds=pooled_prompt_embeds,
        num_inference_steps=steps,
        guidance_scale=guidance_scale,
        height=height,
        width=width,
        output_type="latent",
    ).images
    print(latents.shape)

    del pipeline.transformer
    del pipeline
    flush()

    # Load and configure VAE
    vae = AutoencoderKL.from_pretrained(ckpt_id, subfolder="vae", torch_dtype=torch.bfloat16).to("cuda")
    #vae.enable_tiling()  # Enable tiling for VAE
    #vae.enable_slicing()  # Enable slicing for VAE

    vae_scale_factor = 2 ** (len(vae.config.block_out_channels))
    image_processor = VaeImageProcessor(vae_scale_factor=vae_scale_factor)

    images = []
    # Decode the image
    with torch.no_grad():
        print("Running decoding.")
        print(f"length of latesnt {len(latents)}")
        latents = FluxPipeline._unpack_latents(latents, height, width, vae_scale_factor)
        latents = (latents / vae.config.scaling_factor) + vae.config.shift_factor
        image = vae.decode(latents, return_dict=False)[0]
        image = [image_processor.postprocess(i, output_type="pil") for i in image]
        images = image

    return images

    
    #if(nsfw):
      #  pass
        #pipe.load_lora_weights("lustlyai/Flux_Lustly.ai_Uncensored_nsfw_v1",
        #                   weight_name="flux_lustly-ai_v1.safetensors",
        #                   adapter_name="v1")

        #pipe.set_adapters(["v1"], adapter_weights=[1])
    
    #images = pipe(text,width=width,height=height,num_inference_steps=steps,guidance_scale=guidance_scale,num_images_per_prompt=count).images
    


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