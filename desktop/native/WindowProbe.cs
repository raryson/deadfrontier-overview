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
  public static void Main(string[] args) {
    int parent=0,fixture=0;string custom="";bool once=false;
    for(int i=0;i<args.Length;i++) {
      if(args[i]=="--parent"&&i+1<args.Length)int.TryParse(args[++i],out parent);
      else if(args[i]=="--fixture"&&i+1<args.Length)int.TryParse(args[++i],out fixture);
      else if(args[i]=="--process"&&i+1<args.Length)custom=args[++i];
      else if(args[i]=="--once")once=true;
    }
    try {SetProcessDpiAwarenessContext(new IntPtr(-4));}catch(EntryPointNotFoundException){}
    var serializer=new JavaScriptSerializer();
    do {
      if(parent>0)try{if(Process.GetProcessById(parent).HasExited)return;}catch{return;}
      var windows=new List<object>();
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
        windows.Add(new {handle=handle.ToInt64().ToString(),processId=processId,processName=processName,title=title.ToString(),
          x=rect.Left,y=rect.Top,width=rect.Right-rect.Left,height=rect.Bottom-rect.Top,
          clientX=origin.X,clientY=origin.Y,clientWidth=client.Right,clientHeight=client.Bottom,
          minimized=IsIconic(handle),foreground=GetForegroundWindow()==handle});
        return true;
      },IntPtr.Zero);
      Console.WriteLine(serializer.Serialize(new {windows=windows}));
      if(once)return;
      Thread.Sleep(2000);
    }while(true);
  }
}
