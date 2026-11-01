using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Web.Script.Serialization;

// Enumerates only the configured game's visible top-level windows. No memory,
// packets, authentication, screenshots, files or other window titles are read.
public static class WindowProbe {
  private delegate bool EnumCallback(IntPtr window, IntPtr parameter);
  [StructLayout(LayoutKind.Sequential)] private struct Rect {public int Left,Top,Right,Bottom;}
  [StructLayout(LayoutKind.Sequential)] private struct Point {public int X,Y;}
  [DllImport("user32.dll")] private static extern bool EnumWindows(EnumCallback callback,IntPtr parameter);
  [DllImport("user32.dll")] private static extern bool IsWindowVisible(IntPtr window);
  [DllImport("user32.dll")] private static extern bool IsIconic(IntPtr window);
  [DllImport("user32.dll")] private static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] private static extern uint GetWindowThreadProcessId(IntPtr window,out uint processId);
  [DllImport("user32.dll",CharSet=CharSet.Unicode)] private static extern int GetWindowText(IntPtr window,StringBuilder text,int size);
  [DllImport("user32.dll")] private static extern bool GetWindowRect(IntPtr window,out Rect rect);
  [DllImport("user32.dll")] private static extern bool GetClientRect(IntPtr window,out Rect rect);
  [DllImport("user32.dll")] private static extern bool ClientToScreen(IntPtr window,ref Point point);
  [DllImport("user32.dll")] private static extern bool SetProcessDpiAwarenessContext(IntPtr context);
  [DllImport("user32.dll")] private static extern short GetAsyncKeyState(int key);
  [DllImport("user32.dll")] private static extern bool GetCursorPos(out Point point);
  private static volatile string lootHandle="";
  private static volatile string watchHandle="";
  private static volatile int armGeneration=0,armInitialMask=0;
  public static void Main(string[] args) {
    if(Array.IndexOf(args,"--test-search-hold")>=0){SearchHoldTracker.SelfTest();return;}
    int parent=0,fixture=0;string custom="";bool once=false;
    for(int i=0;i<args.Length;i++) {
      if(args[i]=="--parent"&&i+1<args.Length)int.TryParse(args[++i],out parent);
      else if(args[i]=="--fixture"&&i+1<args.Length)int.TryParse(args[++i],out fixture);
      else if(args[i]=="--process"&&i+1<args.Length)custom=args[++i];
      else if(args[i]=="--once")once=true;
    }
    try {SetProcessDpiAwarenessContext(new IntPtr(-4));}catch(EntryPointNotFoundException){}
    var serializer=new JavaScriptSerializer();
    if(!once){var commands=new Thread(delegate(){try{string line;while((line=Console.ReadLine())!=null){
      if(line=="WATCH"||line.StartsWith("WATCH ")){watchHandle=line.Length>6?line.Substring(6):"";continue;}
      string handle=line.StartsWith("ARM ")?line.Substring(4):"";if(handle==lootHandle)continue;
      int mask=0;int[] keys={0x45,0x54,0x43,1,0x46};
      if(handle.Length>0&&watchHandle==handle&&GetForegroundWindow().ToInt64().ToString()==handle)for(int k=0;k<5;k++)if((GetAsyncKeyState(keys[k])&0x8000)!=0)mask|=1<<k;
      armInitialMask=mask;lootHandle=handle;armGeneration++;
    }}catch{}});commands.IsBackground=true;commands.Start();}
    bool[] previous=null;string priorHandle="";int priorGeneration=-1;var searchHold=new SearchHoldTracker();
    do {
      if(parent>0)try{if(Process.GetProcessById(parent).HasExited)return;}catch{return;}
      var windows=new List<object>();var gameHandles=new HashSet<long>();
      EnumWindows(delegate(IntPtr handle,IntPtr unused) {
        if(!IsWindowVisible(handle))return true;
        uint processId;GetWindowThreadProcessId(handle,out processId);
        string processName;
        try{using(var process=Process.GetProcessById((int)processId))processName=process.ProcessName;}catch{return true;}
        bool match=fixture>0?(int)processId==fixture:
          processName.Equals("DeadFrontier",StringComparison.OrdinalIgnoreCase)||
          processName.Equals("DeadFrontierClient",StringComparison.OrdinalIgnoreCase)||
          processName.Equals("DFClient",StringComparison.OrdinalIgnoreCase)||
          System.Text.RegularExpressions.Regex.IsMatch(processName,@"^DeadFrontierWin\d*$",System.Text.RegularExpressions.RegexOptions.IgnoreCase)||
          (custom.Length>0&&processName.Equals(custom,StringComparison.OrdinalIgnoreCase));
        if(!match)return true;
        var title=new StringBuilder(512);GetWindowText(handle,title,title.Capacity);
        if(fixture>0&&title.ToString()!="DF Overview Capture Fixture")return true;
        Rect rect,client;Point origin=new Point();
        if(!GetWindowRect(handle,out rect)||!GetClientRect(handle,out client))return true;
        ClientToScreen(handle,ref origin);
        if(!IsIconic(handle)&&(client.Right<200||client.Bottom<120))return true;
        gameHandles.Add(handle.ToInt64());
        windows.Add(new {handle=handle.ToInt64().ToString(),processId=processId,processName=processName,title=title.ToString(),
          x=rect.Left,y=rect.Top,width=rect.Right-rect.Left,height=rect.Bottom-rect.Top,
          clientX=origin.X,clientY=origin.Y,clientWidth=client.Right,clientHeight=client.Bottom,
          minimized=IsIconic(handle),foreground=GetForegroundWindow()==handle});
        return true;
      },IntPtr.Zero);
      Console.WriteLine(serializer.Serialize(new {windows=windows}));
      if(once)return;
      // E/F hold timing is observed only in the game. Choice keys and mouse are
      // observed only while anticipation or a recognized loot dialog is
      // armed by the parent AND that exact game's window is in the foreground.
      for(int tick=0;tick<100;tick++){
        Thread.Sleep(20);
        string armed=lootHandle;IntPtr foreground=GetForegroundWindow();
        bool gameFocused=watchHandle==foreground.ToInt64().ToString()&&gameHandles.Contains(foreground.ToInt64())&&!IsIconic(foreground);
        short eState=0,fState=0;
        if(gameFocused){eState=GetAsyncKeyState(0x45);fState=GetAsyncKeyState(0x46);}
        long at=(long)(DateTime.UtcNow-new DateTime(1970,1,1,0,0,0,DateTimeKind.Utc)).TotalMilliseconds;
        long holdAt=(long)(Stopwatch.GetTimestamp()*1000.0/Stopwatch.Frequency);
        string held=searchHold.Observe(gameFocused?foreground.ToInt64().ToString():"",(eState&0x8000)!=0,(fState&0x8000)!=0,holdAt);
        if(held!=null)Console.WriteLine(serializer.Serialize(new {lootSearch=new {handle=foreground.ToInt64().ToString(),key=held,heldMs=1000,at=at}}));
        if(!gameFocused||armed.Length==0||foreground.ToInt64().ToString()!=armed){previous=null;priorHandle="";continue;}
        int[] keys={0x45,0x54,0x43,1,0x46};bool[] pressed=new bool[5],edge=new bool[5];
        if(priorGeneration!=armGeneration){previous=new bool[5];for(int k=0;k<5;k++)previous[k]=(armInitialMask&(1<<k))!=0;priorHandle=armed;priorGeneration=armGeneration;}
        for(int k=0;k<5;k++){short value=k==0?eState:k==4?fState:GetAsyncKeyState(keys[k]);pressed[k]=(value&0x8000)!=0;edge[k]=(value&1)!=0;}
        if(previous!=null&&priorHandle==armed)for(int k=0;k<5;k++)if(edge[k]||(pressed[k]&&!previous[k])){
          Point point;Rect bounds;if(!GetCursorPos(out point)||!GetWindowRect(foreground,out bounds))continue;
          Console.WriteLine(serializer.Serialize(new {lootInput=new {handle=armed,action=k==3?"click":"key",key=k==0?"E":k==1?"T":k==2?"C":k==4?"F":"",at=at,
            x=(double)(point.X-bounds.Left)/Math.Max(1,bounds.Right-bounds.Left),y=(double)(point.Y-bounds.Top)/Math.Max(1,bounds.Bottom-bounds.Top)}}));
        }
        previous=pressed;priorHandle=armed;
      }
    }while(true);
  }
}
