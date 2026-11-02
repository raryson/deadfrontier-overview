#pragma once
#include <algorithm>
#include <chrono>
#include <cctype>
#include <iostream>
#include <string>
#include <vector>
#include <unistd.h>

inline std::string normalizedName(std::string value){
 auto slash=value.find_last_of('/');if(slash!=std::string::npos)value=value.substr(slash+1);
 std::transform(value.begin(),value.end(),value.begin(),[](unsigned char c){return std::tolower(c);});
 for(const auto &suffix:{std::string(".x86_64"),std::string(".app"),std::string(".exe")})if(value.size()>suffix.size()&&value.substr(value.size()-suffix.size())==suffix)value.resize(value.size()-suffix.size());
 value.erase(std::remove_if(value.begin(),value.end(),[](unsigned char c){return c==' '||c=='_'||c=='-';}),value.end());return value;
}
inline bool gameName(const std::string& name,const std::string& custom=""){
 const auto n=normalizedName(name);if(!custom.empty()&&n==normalizedName(custom))return true;
 if(n=="deadfrontier"||n=="deadfrontierclient"||n=="dfclient"||n=="deadfrontier.x8"||n=="deadfrontier.ex")return true;
 const std::string prefix="deadfrontierwin";return n.rfind(prefix,0)==0&&std::all_of(n.begin()+prefix.size(),n.end(),[](unsigned char c){return std::isdigit(c);});
}
inline std::string jsonString(const std::string& value){std::string out="\"";for(unsigned char c:value){if(c=='"'||c=='\\'){out+='\\';out+=c;}else if(c=='\n')out+="\\n";else if(c=='\r')out+="\\r";else if(c=='\t')out+="\\t";else if(c>=32)out+=c;}return out+'"';}
inline long long wallMs(){return std::chrono::duration_cast<std::chrono::milliseconds>(std::chrono::system_clock::now().time_since_epoch()).count();}
inline long long monotonicMs(){return std::chrono::duration_cast<std::chrono::milliseconds>(std::chrono::steady_clock::now().time_since_epoch()).count();}
struct ProbeOptions{int parent=0,fixture=0;std::string custom;bool once=false,selfTest=false;};
inline ProbeOptions options(int argc,char**argv){ProbeOptions o;for(int i=1;i<argc;i++){std::string a=argv[i];if((a=="--parent"||a=="--fixture")&&i+1<argc){int n=std::stoi(argv[++i]);if(a=="--parent")o.parent=n;else o.fixture=n;}else if(a=="--process"&&i+1<argc)o.custom=argv[++i];else if(a=="--once")o.once=true;else if(a=="--self-test")o.selfTest=true;}return o;}
inline int commonSelfTest(){if(!gameName("DeadFrontier")||!gameName("Dead Frontier.app")||!gameName("DeadFrontierWin288")||!gameName("DeadFrontier.x86_64")||gameName("DeadFrontier Overview")||gameName("firefox")||!gameName("Custom Client","Custom Client"))return 1;std::cout<<"{\"ok\":true}"<<std::endl;return 0;}
struct GameKeys{
 std::string focus;bool chordWas=false,eWas=false,fWas=false,eSent=false,fSent=false;long long eAt=0,fAt=0;
 void sample(const std::string& handle,bool e,bool f,bool shift,bool ctrl,bool alt){
  const auto now=monotonicMs();if(focus!=handle){focus=handle;chordWas=eWas=fWas=eSent=fSent=false;eAt=fAt=now;}
  if(handle.empty())return;
  bool chord=f&&shift&&!ctrl&&!alt;if(chord&&!chordWas)std::cout<<"{\"lootCapture\":{\"handle\":"<<jsonString(handle)<<",\"at\":"<<wallMs()<<"}}"<<std::endl;chordWas=chord;
  if(!e)eSent=false;else if(!eWas)eAt=now;
  if(!f)fSent=false;else if(!fWas)fAt=now;
  const char* held=e&&!eSent&&now-eAt>=1000?"E":f&&!fSent&&now-fAt>=1000?"F":nullptr;
  if(held){if(*held=='E')eSent=true;else fSent=true;std::cout<<"{\"lootSearch\":{\"handle\":"<<jsonString(handle)<<",\"key\":"<<jsonString(held)<<",\"heldMs\":1000,\"at\":"<<wallMs()<<"}}"<<std::endl;}
  eWas=e;fWas=f;
 }
};
