#import <AppKit/AppKit.h>
#import <CoreGraphics/CoreGraphics.h>
#include "UnixProbeCommon.hpp"
#include <map>
#include <set>
#include <signal.h>
#include <thread>

static std::string utf8(NSString* value){return value?std::string(value.UTF8String):"";}
static std::string launched(NSRunningApplication* application){return application.launchDate?std::to_string(static_cast<long long>(application.launchDate.timeIntervalSince1970*1000)):"";}
int main(int argc,char**argv){
 const auto o=options(argc,argv);if(o.selfTest)return commonSelfTest();GameKeys keys;
 do{@autoreleasepool{
  if(o.parent>0&&kill(o.parent,0)!=0)break;
  std::map<pid_t,std::pair<std::string,std::string>> clients;
  for(NSRunningApplication* application in NSWorkspace.sharedWorkspace.runningApplications){const auto name=utf8(application.executableURL.lastPathComponent),label=utf8(application.localizedName);if(o.fixture?application.processIdentifier==o.fixture:gameName(name,o.custom)||gameName(label,o.custom))clients[application.processIdentifier]={name.empty()?label:name,launched(application)};}
  NSArray* entries=CFBridgingRelease(CGWindowListCopyWindowInfo(kCGWindowListOptionAll|kCGWindowListExcludeDesktopElements,kCGNullWindowID));
  const pid_t front=NSWorkspace.sharedWorkspace.frontmostApplication.processIdentifier;std::set<CGWindowID> gameWindows;CGWindowID frontWindow=0;
  NSMutableArray* windows=[NSMutableArray array];NSMutableArray* processes=[NSMutableArray array];
  for(NSDictionary* entry in entries){pid_t pid=[entry[(id)kCGWindowOwnerPID] intValue];if(!clients.count(pid)||[entry[(id)kCGWindowLayer] intValue]!=0)continue;NSString* title=entry[(id)kCGWindowName]?:@"";if(o.fixture&&![title isEqualToString:@"DF Overview Capture Fixture"])continue;CGRect bounds;if(!CGRectMakeWithDictionaryRepresentation((__bridge CFDictionaryRef)entry[(id)kCGWindowBounds],&bounds)||bounds.size.width<200||bounds.size.height<120)continue;CGWindowID handle=[entry[(id)kCGWindowNumber] unsignedIntValue];BOOL visible=[entry[(id)kCGWindowIsOnscreen] boolValue];if(visible&&pid==front&&!frontWindow)frontWindow=handle;gameWindows.insert(handle);const auto& process=clients.at(pid);
   [windows addObject:@{@"handle":@(handle).stringValue,@"processId":@(pid),@"processStartedAt":[NSString stringWithUTF8String:process.second.c_str()],@"processName":[NSString stringWithUTF8String:process.first.c_str()],@"title":title,@"x":@(bounds.origin.x),@"y":@(bounds.origin.y),@"width":@(bounds.size.width),@"height":@(bounds.size.height),@"clientX":@(bounds.origin.x),@"clientY":@(bounds.origin.y),@"clientWidth":@(bounds.size.width),@"clientHeight":@(bounds.size.height),@"minimized":@(!visible),@"foreground":@(visible&&handle==frontWindow)}];
  }
  for(const auto& client:clients)[processes addObject:@{@"processId":@(client.first),@"processStartedAt":[NSString stringWithUTF8String:client.second.second.c_str()]}];
  NSData* json=[NSJSONSerialization dataWithJSONObject:@{@"windows":windows,@"clients":processes} options:0 error:nil];if(json)std::cout<<std::string(static_cast<const char*>(json.bytes),json.length)<<std::endl;if(o.once)break;
  // Key state is optional and is queried only for the recognized foreground
  // game. A denied Input Monitoring permission never blocks automatic OCR.
  for(int tick=0;tick<40;tick++){@autoreleasepool{std::this_thread::sleep_for(std::chrono::milliseconds(50));bool focused=frontWindow&&NSWorkspace.sharedWorkspace.frontmostApplication.processIdentifier==front&&CGPreflightListenEventAccess();const auto down=[&](CGKeyCode code){return focused&&CGEventSourceKeyState(kCGEventSourceStateCombinedSessionState,code);};keys.sample(focused?std::to_string(frontWindow):"",down(14),down(3),down(56)||down(60),down(59)||down(62),down(58)||down(61));}}
 }}while(true);return 0;
}
