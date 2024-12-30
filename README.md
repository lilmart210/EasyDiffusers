# Easy Diffusers
### Make a diffusion model
Refer to the video in order to see an example  
[![EasyDiffusers](https://img.youtube.com/vi/Z5y2Y5v_yQ4/default.jpg)](https://youtu.be/Z5y2Y5v_yQ4)

## Purpose
### Meant to be an environment where you can use Diffusers or other ML pipelines outside of Jupyter Notebook  
### Provides a convenient way to interact with ml models  
(![image copy.png](https://github.com/lilmart210/EasyDiffusers/blob/main/image copy.png))
## Getting Started | How To  
> example command `docker run -dit --gpus all --name diffusers2 -e PLATFORM="LINUX" -p 4809:7377 --mount type=bind,source="$(pwd)",target=/app/Volume mrmartinwatson/easydiff:v1`  
> when resusing old docker files, make sure you chmod the volume folder and all of its children from inside the image `chmod -R 777 Volume`  
> these packages need to be installled  
> pip install websockets  
> pip install diffusers["torch"] transformers  
> pip install torch torchvision torchaudio  
> pip install accelerate  

### Build Docker

1. Download the Repository
2. Skip steps 3 if you don't intend on modifying source code
3. `npm install` in base repository directory
4. `cd FrontEnd` and run `npm install`. then run `npm run build` and Return to the root directory using `cd ..`
5. run `docker build -t <mrmartinwatson/easydiff:v1> ./` substitute a-name for whatever you want. I use easydiff. Push to cloude `docker image push <mrmartinwatson/easydiff:v1>`  
> the command i use `docker run -dit --gpus all --name diffusers2 -e PLATFORM="LINUX" -p 4809:7377 --restart always --mount type=bind,source="$(pwd)",target=/app/Volume mrmartinwatson/easydiff:v1`  
> docker push mrmartinwatson/easydiff:v1
If no errors than you have successfully built the image  
> This Communicates over https, so make sure you are prefixing `https://<ipaddress:port>/`  
> to push to docker `docker push -t <your name>:<your tag> ./  
> to pull official docker pull mrmartinwatson/easydiff:v1
### Setup the container

This image Communicates on the Port 7377. Remap it if you want to 

Example docker command `docker run -dit --gpus all --name diffuser2 -p 4505:7377 --mount type=bind,source="$(pwd)",target=/app/Volume mrmartinwatson/easydiff:v1`  

> If you are using Nvidia gpus, you may have to install nvidia-runtime container and specify --runtime nvidia  
> By default, there is a model shown and a default configuration. Inside the `anime.py` file is an example of how to use `helper.py` to communicate with the backend  
> Before you  

### config.json
This file must contain an array `[]`
The array contain the models. Example config.json file
```
[
  {
      "name" : "MyModel",
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
      "env" : "default"
  },
]
```
The field `env` refers to the python environment you want to run this code in. missing environments will trigger the app to crash.  
the field `source` refers to the name of the file in `Volume/Models` folder  
The filed `options` refers to the optionble parameters. This is an array but does not need to have any specific value

> All Fields Must Be Specified


### How it Works
Any image data will be sent to `Uploads` Folder  
Models will be dropped into `Models` Folder  
cached models from huggingface/Diffusers will be stored in the `Data` Folder  
`Environments` folder contains python venv  
`config.json` contains the configuration of the models  


### Accessing the Running Docker Container
In the terminal, type `docker exec -it <image_name> bash` This will bring you to a bash session where we can do things. 

### Installing Packages (IMPORTANT)
The image comes with pip installed. Inside the package we must navigate to `/app/Volume/Environments`  
This directory will have all of your python virtual environments. use `source <default>/bin/activate` or `. <default>/bin/activate`in order to activate your environment. replace default with the name of your created environment.  
once your environment is activated you can simply `pip install <package-name>` and it will be installed into the environment. 

### Creating a Python Environment (IMPORTANT)
inside your `/app/Volume/Environments` folder you should see a `default` folder.  
if you do not see one, you should create a default folder using the command `python -m venv default`  
This will create a python environment. To activate it, use `source default/bin/activate`.   
if accessed from windos use `default\Scripts\activate.bat` in cmd or `default\Scripts\Activate.ps1` from powershell  
once you are finished. You can type `deactivate` to deactivate the environment. You can also delete the folder to remove the venv 
You can repeat these steps to make any kind of virtual environment

### Packages  
To install the neccesary packages for anime.py, you need to first download diffusers, huggingface pytorch, transformers as well as a few more. However the website for each should contain what their dependencies are.

### Pipeline
In order to use this effectively, Once you have a model that you like. You drop the model into the `Models` folder. Then edt `config.json` to include your new model 

## Env Variables (IMPORTANT)  
> -e PLATFORM = "WINDOWS" | "LINUX" depending on the platform you use, you need to specify one of the other