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
// A rising edge, scoped to one foreground game window. It never consumes keys.
public sealed class LootCaptureHotkey {
  private string handle="";private bool down=false;private long last=-1000;
  public bool Observe(string current,bool chord,long now){
    if(current!=handle){handle=current;down=chord;return false;}
    if(current.Length==0){down=false;return false;}
    bool fire=chord&&!down&&now-last>=400;down=chord;if(fire)last=now;return fire;
  }
  public static void SelfTest(){
    var h=new LootCaptureHotkey();
    if(h.Observe("game",false,0)||!h.Observe("game",true,20)||h.Observe("game",true,500))throw new Exception("Hotkey edge");
    h.Observe("game",false,600);if(!h.Observe("game",true,650))throw new Exception("Hotkey rearm");
    h.Observe("",false,700);if(h.Observe("other",true,800)||h.Observe("other",true,1200))throw new Exception("Hotkey focus");
    h.Observe("other",false,1300);if(!h.Observe("other",true,1400))throw new Exception("Hotkey release");
    h.Observe("other",false,1450);if(h.Observe("other",true,1500))throw new Exception("Hotkey cooldown");
  }
}
