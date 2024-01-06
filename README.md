# Easy Diffusers
### Make a diffusion model
Refer to the video in order to see an example  
[![EasyDiffusers](https://img.youtube.com/vi/Z5y2Y5v_yQ4/default.jpg)](https://youtu.be/Z5y2Y5v_yQ4)

## Purpose
### Meant to be an environment where you can use Diffusers or other ML pipelines outside of Jupyter Notebook  
### Provides a convenient way to interact with ml models

## Getting Started | How To

### Build Docker

1. Download the Repository
2. Skip steps 3 if you don't intend on modifying source code
3. `npm install` in base repository directory
4. `cd FrontEnd` and run `npm install`. then run `npm run build` and Return to the root directory using `cd ..`
5. run `docker build -t <a-name> ./` substitute a-name for whatever you want. I use easydiff

If no errors than you have successfully built the image  

### Setup the container

This image Communicates on the Port 7377. Remap it if you want to  

Example docker command `docker run -dit --rm --name diffuser -p 8789:7377 --mount type=bind,source="$(pwd)",target=/app/Volume easydiff`

> When using `--mount` flag, the correct file path is not instantiated as they are dockerfile instructions.  
To fix this, The binded volume must have these directories and files  
> Models  
> Uploads  
> Data  
> Environments  
> config.json  

The Environments Folder must have an environment called `default`. Refer to Creating a Python Evnironment 

### config.json
This file must contain an array `[]`
The array contain the models. Example config.json file
```
[
  {
      "name" : "MyModel",
      "type" : "text2image",
      "source" : "example.py",
      "options" : [
          {
              "name" : "inference",
              "default" : 20,
              "type" : "select",
              "selection" : [5,10,20,40,100,200]
          },
          {
              "name" : "count",
              "default" : 1,
              "max" : 4,
              "min" : 1,
              "step" : 1,
              "type" : "number"
          },
          {
              "name" : "cpu",
              "default" : true,
              "type" : "boolean"
          },
          {
              "name" : "negatives",
              "default":"extra arms",
              "type" : "string"
          }
      ],
      "allowImages" : false,
      "env" : "default"
  },
]
```
The field `type` is non-functional but specify it anyways.  
The field `env` refers to the python environment you want to run this code in. missing environments will trigger the app to crash.  
the field `allowImages` allows the upload of media(not just images)
the field `source` refers to the name of the file in `Models` folder

> All Fields Must Be Specified


### How it Works
Any image data will be sent to `Uploads` Folder  
Models will be dropped into `Models` Folder  
cached models from huggingface/Diffusers will be stored in the `Data` Folder  
`Environments` folder contains python venv  
`config.json` contains the configuration of the models  
The FrontEnd of this project saves data in the localstorage(i.e. chrome cache). If gen images are lost, look in `Uploads` Folder


### Accessing the Running Docker Container
In the terminal, type `docker exec -it <image_name> bash` This will bring you to a bash session where we can do things. 

### Installing Packages
The image comes with pip installed. Inside the package we must navigate to `/app/Volume/Environments`  
This directory will have all of your python virtual environments. use `source <folder>/bin/activate` or `. <folder>/bin/activate`in order to activate your environment.  
once your environment is activated you can simply `pip install <package-name>` and it will be installed into the environment. 

### Creating a Python Environment
inside your `/app/Volume/Environments` folder you should see a `default` folder.  
if you do not see one, you should create a default folder using the command `python -m venv default`  
This will create a python environment. To activate it, use `source default/bin/activate`.   
if accessed from windos use `default\Scripts\activate.bat` in cmd or `default\Scripts\Activate.ps1` from powershell  
once you are finished. You can type `deactivate` to deactivate the environment. You can also delete the folder to remove the venv 
You can repeat these steps to make any kind of virtual environment


### Pipeline
In order to use this effectively, Once you have a model that you like. You drop the model into the `Models` folder. Then edt `config.json` to include your new model 

## Env Variables

SERVERLOCATION
: a string for server location or foreign ip address. ALTHOUGH ABLE, NOT INTENDED FOR PUBLIC USE  
PLATFORM
: `'Windows'` or undefined. Leave undefined if on linux or max. Used for python venv. NOT NECCESARY IF USING DOCKER IMAGE  
