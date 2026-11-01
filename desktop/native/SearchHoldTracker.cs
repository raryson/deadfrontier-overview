using System;

// Pure timing state: never reads keys itself and never represents a pickup.
public sealed class SearchHoldTracker {
  private string handle="";
  private readonly long[] started={-1,-1};
  private readonly bool[] emitted={false,false};
  public string Observe(string current,bool e,bool f,long now){
    if(current!=handle){handle=current;Reset();}
    if(current.Length==0){Reset();return null;}
    bool[] pressed={e,f};string result=null;
    for(int i=0;i<2;i++){
      if(!pressed[i]){started[i]=-1;emitted[i]=false;continue;}
      if(started[i]<0)started[i]=now;
      if(!emitted[i]&&now-started[i]>=1000){emitted[i]=true;result=i==0?"E":"F";}
    }
    return result;
  }
  private void Reset(){for(int i=0;i<2;i++){started[i]=-1;emitted[i]=false;}}
  public static void SelfTest(){
    var h=new SearchHoldTracker();
    if(h.Observe("game",true,false,0)!=null||h.Observe("game",true,false,999)!=null||h.Observe("game",true,false,1000)!="E")throw new Exception("E threshold");
    if(h.Observe("game",true,false,2000)!=null)throw new Exception("Repeated hold");
    h.Observe("game",false,false,2100);h.Observe("game",false,true,2200);
    if(h.Observe("game",false,true,3200)!="F")throw new Exception("F threshold");
    h.Observe("",true,true,3300);h.Observe("other",true,false,3400);
    if(h.Observe("other",true,false,4399)!=null||h.Observe("other",true,false,4400)!="E")throw new Exception("Focus reset");
    Console.WriteLine("{\"holdTiming\":true,\"release\":true,\"focusReset\":true}");
  }
}
