FROM node:21-bookworm

RUN apt-get update || : && apt-get install python-is-python3 -y
RUN apt-get install python3-pip -y
RUN apt-get install python3-full -y
# RUN python -m ensurepip --upgrade

WORKDIR /app

# make folders
RUN mkdir Volume
RUN mkdir FrontEnd
RUN mkdir FrontEnd/dist

# make folder available to user
RUN mkdir Volume/Models
RUN mkdir Volume/Uploads
RUN mkdir Volume/Data
RUN mkdir Volume/Environments

RUN echo "[]" > Volume/config.json

#create a defualt venv
RUN python -m venv Volume/Environments/default

# copy in the data
COPY example.com.* ./
COPY Volume/Models/Helper.py Volume/Models

# copy packages
COPY package* ./
RUN npm install

# Must Build FrontEnd before running dockerfile
ADD FrontEnd/dist FrontEnd/dist

# copy Back end
COPY *.js ./
EXPOSE 7377

CMD [ "npm","run","start"]