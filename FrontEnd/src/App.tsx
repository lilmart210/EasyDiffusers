import { useState, useRef, useEffect} from 'react'
import './App.css'
import axios from 'axios';
//for some reason i put the styling in index.css

type AIModels = {
  name : string,
  type : 'text2text' | 'text2image',
  source : string,
  options : Array<{
    type : 'select',
    default : number | string,
    name : string,
    selection : Array<number | string>,
    value? : number | string,
  } | {
    name : string,
    default : number
    type : 'number',
    min? : number,
    max? : number,
    value? : number,
    step? : number
  } | {
    type : 'boolean',
    default : boolean,
    value? : boolean,
    name : string
  } | {
    type : 'string',
    default : string,
    value? : string,
    name : string
  }>
  allowImagaes : boolean
}


type message = {
  from : 'User' | 'Model' | 'Cmd',
  time : string,
  text? : string
  ImageSrc? : string,
  VideoSrc? : string,
  AudioSrc? : string
}

type GPTServerResponse = {
  choices : Array<{message : {content : string,role : 'assistant'}}>,
  llmodel : string,
  usage : {
    completion_tokens : number,
    prompt_tokens : number,
    total_tokens : number
  }
}

type FailedServerResponse = {
  error : true,
  message : message[]
}
type SuccessServerResponse = {
  error : false,
  message : message[]
}

type ServerResponse = FailedServerResponse | SuccessServerResponse

type Chat = {
  type : AIModels,
  history : message[]
}

function App() {
  const [AddPopup,SetAddPopup] = useState(false);
  const [ChatList,SetChatList] = useState<Chat[]>([]);
  const [SelectedChat,SetSelectedChat] = useState<number>();
  const [PendingResponse,SetPendingResponse] = useState(false);
  const InputFiles = useRef<HTMLInputElement>(null);
  const [ViewTerminal,SetViewTerminal] = useState(false);

  const [Models,SetModels] = useState<AIModels[]>([]);

  useEffect(()=>{
    LoadChatList();
  },[])
  useEffect(()=>{
    SaveChatList();
  },[ChatList])
  

  useEffect(()=>{
    GetConfiguration();
  },[])

  function GetConfiguration(){
    axios.get('/configuration').then((res)=>{
      SetModels(res.data)
    })
  }

  const SelectRef = useRef<HTMLSelectElement>(null);

  async function SendMessage(chat : Chat){
    if(!chat.history.length) return;
    //filter command prompts
    const body = {
      model : chat.type,
      history : chat.history.filter(itm=>itm.from != 'Cmd')
    }
    SetPendingResponse(true);

    const resp = await fetch('/Generate', {
      method : 'POST',
      headers : {
        "Content-Type" : "application/json"
      },
      body : JSON.stringify(body),

    })
    if(!resp.body) return SetPendingResponse(false);
    const reader = resp.body.getReader();
    while(true){
      const {done,value}  = await reader.read();
      if(done){
        SetPendingResponse(false);
        break;
      }
      const decoded = new TextDecoder().decode(value);
      
      try{
        const converted : ServerResponse = JSON.parse(decoded);
        converted.message.map(itm=>pushmessage(itm,false));
      }catch(e){
        pushmessage({
          from : 'Cmd',
          time : (new Date()).toLocaleString(),
          text : `(((failed to parse))) \n${decoded}`
        },false)
      }
    }

  }


  useEffect(()=>{
    if(SelectedChat == undefined || SelectedChat > ChatList.length) return;

  },[ChatList])
  
  function pushmessage(msg : message,getResponse : boolean){
    SetChatList(prev=>{
      const cpy : Chat[] = JSON.parse(JSON.stringify(prev));
      
      if(SelectedChat == undefined || cpy.length < SelectedChat)return prev;
      const chat = cpy[SelectedChat];
      chat.history.push(msg);

      if(getResponse) SendMessage(chat);
      return cpy;
    })
    
  }

  async function KeyDown(e : React.KeyboardEvent<HTMLInputElement>){
    if(e.key != 'Enter') return;

    const stime = new Date()

    if(!InputFiles.current) return;

    const text = e.currentTarget.value;
    e.currentTarget.value = '';

    //upload the images first
    if(InputFiles.current.files){
      const filelist = [...InputFiles.current.files];
      const fd = new FormData();
      filelist.map((itm,i)=>{
        fd.append(`file-${i}`,itm);
      })
      const msgarr = await axios.post('/upload',fd,{headers : {'Content-Type' : 'multipart/form-data'}})
      InputFiles.current.value = '';
      //save the files to the chat list
      const fileloclist = msgarr.data;
      fileloclist.map((location : string)=>{
        pushmessage({
          from : 'User',
          time : stime.toLocaleString(),
          ImageSrc : location
        },false)
      });
    }
  
    const msg : message = {
      text : text,
      time : stime.toLocaleString(),
      from : 'User'
    }
    pushmessage(msg,true);

  }
  function SubmitChoice(){
    SetAddPopup(false);
    if(!SelectRef.current) return;
    const aval = SelectRef.current.value as AIModels['name'];
    const amodel = Models.find((itm)=>itm.name == aval);
    if(!amodel) return;

    const newchat : Chat = {history : [],type :amodel};  
    SetChatList(prev=>[...prev,newchat]);
  }

  function RemoveChat(){
    SetChatList(prev=>prev.filter((itm,i)=>i != SelectedChat));
    SetSelectedChat(undefined);
  }

  function UpdateOption(aname : string,aval : any){
    SetChatList(prev=>{
      if(SelectedChat == undefined) return prev;
      const chatcopy : Chat[] = JSON.parse(JSON.stringify(prev));
      const achat = chatcopy[SelectedChat];

      const newopts = achat.type.options.map((itm,i)=>{
        if(itm.name != aname) return itm;
        return {
          ...itm,
          value : aval
        }
      })

      achat.type.options = newopts

      return chatcopy;
    })
  }

  function SetInputValue(e : React.ChangeEvent<HTMLInputElement>,aname : string){
    const atype = e.currentTarget.type;
    if(atype == 'checkbox'){
      UpdateOption(aname,e.currentTarget.checked)
    }else if(atype == 'number'){
      UpdateOption(aname,e.currentTarget.valueAsNumber)
    } else if(atype == 'text'){
      UpdateOption(aname,e.currentTarget.value)
    }
  }

  function SetSelectValue(e : React.ChangeEvent<HTMLSelectElement>,aname : string){
    const newval = e.currentTarget.value;
    UpdateOption(aname,newval);
  }

  function SaveChatList(){
    localStorage.setItem('ChatList',JSON.stringify(ChatList));
  }

  function LoadChatList(){
    const cl = localStorage.getItem('ChatList');
    if(!cl) return;
    const newchats = JSON.parse(cl);
    SetChatList(newchats);
  }

  
  return (
    <>
      <div className='Header'>
        <label>Systic A.I.</label>
        <button onClick={()=>SetViewTerminal(prev=>!prev)}>{`${ViewTerminal ? 'Chat' : 'Terminal'}`}</button>
        <button onClick={()=>GetConfiguration()}>refresh</button>
      </div>
      <div className='Body'>
        <div className='Chatlist'>
          <h3>Chatlist</h3>
          {
            ChatList.map((itm,i)=>(
              <button key={i} onClick={()=>SetSelectedChat(prev=> prev!=i ? i : undefined)}>{`(${itm.type.name})${itm.history.length && itm.history[0].text && itm.history[0].text.slice(0,10)}`}</button>
            ))
          }
          <button onClick={()=>SetAddPopup(true)}>+</button>
          {
            SelectedChat != undefined && <button onClick={RemoveChat} className='Delete'>Delete Chat</button>
          }
        </div>

        <div className='Chat'>
          <div className='MessageContainer'>
            {
              SelectedChat != undefined && ChatList[SelectedChat].history.filter((itm)=>ViewTerminal ?itm.from == 'Cmd' : itm.from !='Cmd').map((itm,i)=>(
                <div className={`Message ${itm.from}`} key={i}>
                  {itm.ImageSrc && <img src={itm.ImageSrc}/>}
                  {itm.text && <div className='Text'>{itm.text}</div>}
                  <label className='Date'>{itm.time}</label>
                </div>
              ))
            }
            {
              PendingResponse && (
                <div className='Message Loading'>{`\u{229B}`}</div>
              )
            }
          </div>
          
          <div className='InputPanel'>
            <input ref={InputFiles} className='Files' type='file' multiple disabled={SelectedChat == undefined || PendingResponse}/>
            <input className='Text' onKeyDown={KeyDown} disabled={SelectedChat == undefined || PendingResponse}></input>
          </div>
        </div>
        <div className='ChatOptionPanel'>
          {
            SelectedChat != undefined && ChatList[SelectedChat].type.options.map((itm,i)=>(
              <div className='Row' key={i}>
                <label>{itm.name}</label>
                {
                  itm.type == 'boolean' && <input onChange={(e)=>SetInputValue(e,itm.name)} type='checkbox' checked={itm.value || itm.default} />
                }
                {
                  itm.type == 'number' && <input onChange={(e)=>SetInputValue(e,itm.name)} type='number' value={itm.value || itm.default} min={itm.min} max={itm.max} step={itm.step}/>
                }
                {
                  itm.type == 'string' && <input onChange={(e)=>SetInputValue(e,itm.name)} type='text' value={itm.value || itm.default}/>
                }
                {
                  itm.type == 'select' && <select onChange={(e)=>SetSelectValue(e,itm.name)} value={itm.value || itm.default}>
                    {
                      itm.selection.map((selitm,j)=>(
                        <option value={selitm} key={j}>{selitm}</option>
                      ))
                    }
                  </select>
                }
              </div>
            ))
          }
        </div>
      </div>

      <div className={`Popup ${AddPopup && 'Visible'}`}> 
        <div className='Header'>
          <label>Pick Model</label>
          <button onClick={()=>SetAddPopup(false)}>x</button>
        </div>
        <select ref = {SelectRef}>
            {
              Models.map((itm,i)=>(
                <option key={i} value={itm.name}>{`${itm.name}(${itm.type})`}</option>
              ))
            }
        </select>

        <button onClick={SubmitChoice}>select</button>
      </div>
    </>
  )
}

export default App
