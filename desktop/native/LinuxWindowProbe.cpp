#include "UnixProbeCommon.hpp"
#include <X11/Xlib.h>
#include <X11/Xatom.h>
#include <X11/keysym.h>
#include <filesystem>
#include <fstream>
#include <sstream>
#include <map>
#include <set>
#include <thread>
#include <signal.h>

static int ignoreXError(Display*,XErrorEvent*){return 0;}
static std::vector<unsigned long> property(Display*d,Window w,const char*name){Atom actual;int format;unsigned long count,remaining;unsigned char*data=nullptr;std::vector<unsigned long> out;if(XGetWindowProperty(d,w,XInternAtom(d,name,False),0,4096,False,AnyPropertyType,&actual,&format,&count,&remaining,&data)==Success&&data){if(format==32){auto values=reinterpret_cast<unsigned long*>(data);out.assign(values,values+count);}XFree(data);}return out;}
static std::string title(Display*d,Window w){Atom actual;int format;unsigned long count,remaining;unsigned char*data=nullptr;std::string out;if(XGetWindowProperty(d,w,XInternAtom(d,"_NET_WM_NAME",False),0,512,False,XInternAtom(d,"UTF8_STRING",False),&actual,&format,&count,&remaining,&data)==Success&&data){if(format==8)out.assign(reinterpret_cast<char*>(data),count);XFree(data);}return out;}
static std::string readLine(const std::string&path){std::ifstream in(path);std::string value;std::getline(in,value);return value;}
static std::string startTime(int pid){auto stat=readLine("/proc/"+std::to_string(pid)+"/stat");auto close=stat.rfind(')');if(close==std::string::npos)return"";std::istringstream fields(stat.substr(close+2));std::string field;for(int i=3;i<=22;i++)if(!(fields>>field))return"";return field;}
int main(int argc,char**argv){
 const auto o=options(argc,argv);if(o.selfTest)return commonSelfTest();
 if(std::string(getenv("XDG_SESSION_TYPE")?getenv("XDG_SESSION_TYPE"):"")=="wayland"){std::cout<<"{\"unsupported\":\"wayland\"}"<<std::endl;return 0;}
 Display*d=XOpenDisplay(nullptr);if(!d){std::cout<<"{\"unsupported\":\"x11Unavailable\"}"<<std::endl;return 0;}XSetErrorHandler(ignoreXError);const auto root=DefaultRootWindow(d);GameKeys keys;
 do{
  if(o.parent>0&&kill(o.parent,0)!=0)break;
  std::map<int,std::pair<std::string,std::string>> clients;
  for(const auto&entry:std::filesystem::directory_iterator("/proc")){const auto id=entry.path().filename().string();if(id.empty()||!std::all_of(id.begin(),id.end(),[](unsigned char c){return std::isdigit(c);}))continue;int pid=std::stoi(id);const auto name=readLine(entry.path().string()+"/comm");std::error_code error;auto executable=std::filesystem::read_symlink(entry.path()/"exe",error).filename().string();if(o.fixture?pid==o.fixture:gameName(name,o.custom)||(!error&&gameName(executable,o.custom)))clients[pid]={name,startTime(pid)};}
  auto list=property(d,root,"_NET_CLIENT_LIST");if(list.empty()){Window returnedRoot,parent,*children=nullptr;unsigned int n=0;if(XQueryTree(d,root,&returnedRoot,&parent,&children,&n)&&children){list.assign(children,children+n);XFree(children);}}
  auto active=property(d,root,"_NET_ACTIVE_WINDOW");Window focused=active.empty()?0:active[0];std::set<Window> gameWindows;
  std::ostringstream packet;packet<<"{\"windows\":[";bool comma=false;
  for(auto handle:list){auto pids=property(d,handle,"_NET_WM_PID");if(pids.empty()||!clients.count(static_cast<int>(pids[0])))continue;const int pid=static_cast<int>(pids[0]);XWindowAttributes a;if(!XGetWindowAttributes(d,handle,&a)||a.override_redirect)continue;const auto name=title(d,handle);if(o.fixture&&name!="DF Overview Capture Fixture")continue;if(a.width<200||a.height<120)continue;int x,y;Window child;if(!XTranslateCoordinates(d,handle,root,0,0,&x,&y,&child))continue;gameWindows.insert(handle);if(comma)packet<<',';comma=true;const auto&process=clients.at(pid);packet<<"{\"handle\":"<<jsonString(std::to_string(handle))<<",\"processId\":"<<pid<<",\"processStartedAt\":"<<jsonString(process.second)<<",\"processName\":"<<jsonString(process.first)<<",\"title\":"<<jsonString(name)<<",\"x\":"<<x<<",\"y\":"<<y<<",\"width\":"<<a.width<<",\"height\":"<<a.height<<",\"clientX\":"<<x<<",\"clientY\":"<<y<<",\"clientWidth\":"<<a.width<<",\"clientHeight\":"<<a.height<<",\"minimized\":"<<(a.map_state==IsViewable?"false":"true")<<",\"foreground\":"<<(focused==handle?"true":"false")<<'}';}
  packet<<"],\"clients\":[";comma=false;for(const auto&client:clients){if(comma)packet<<',';comma=true;packet<<"{\"processId\":"<<client.first<<",\"processStartedAt\":"<<jsonString(client.second.second)<<'}';}packet<<"]}";std::cout<<packet.str()<<std::endl;if(o.once)break;
  for(int tick=0;tick<40;tick++){std::this_thread::sleep_for(std::chrono::milliseconds(50));auto front=property(d,root,"_NET_ACTIVE_WINDOW");Window w=front.empty()?0:front[0];char state[32]={};if(gameWindows.count(w))XQueryKeymap(d,state);const auto down=[&](KeySym key){auto code=XKeysymToKeycode(d,key);return code&&((state[code/8]>>(code%8))&1);};keys.sample(gameWindows.count(w)?std::to_string(w):"",down(XK_e),down(XK_f),down(XK_Shift_L)||down(XK_Shift_R),down(XK_Control_L)||down(XK_Control_R),down(XK_Alt_L)||down(XK_Alt_R));}
 }while(true);XCloseDisplay(d);return 0;
}
