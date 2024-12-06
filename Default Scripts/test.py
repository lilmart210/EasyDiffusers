import Helper as H
import time


def Main(ws,data,config,messages,chat,params,files):
    """
        params is in key value format
        documentation is in helper.py
    """    
    #data from server
    H.Update(ws,"Recieved Data")

    #current time in ms
    date = H.Time()
    
    H.Update(ws,"generating message")
    
    H.SendChat(chat,date,"you not forreal")
    
    H.Update(ws,"done generating message, closing")

    print(date)
    H.GetFrom(ws,date)
    



if __name__ == '__main__':
    H.Loop(Main)