"""语音验收：时长与响度统计。用法: python tools/measure_voices.py [对比目录]"""
import subprocess, glob, statistics, re, sys, os
def dur(f): return float(subprocess.run(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',f],capture_output=True,text=True).stdout)
def lufs(f):
    o=subprocess.run(['ffmpeg','-nostats','-i',f,'-af','ebur128','-f','null','-'],capture_output=True,text=True).stderr
    return float(re.findall(r'I:\s+(-?[\d.]+) LUFS',o)[-1])
root=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','assets','audio','voice')
files=sorted(glob.glob(os.path.join(root,'*.mp3')))
d={os.path.basename(f):dur(f) for f in files}; L=[lufs(f) for f in files]
print(f'{len(d)} 句  平均时长 {statistics.mean(d.values()):.2f}s  最长 {max(d.values()):.2f}s')
print(f'响度 LUFS  min {min(L):.1f}  max {max(L):.1f}  平均 {statistics.mean(L):.2f}')
if len(sys.argv)>1:
    b={os.path.basename(f):dur(f) for f in glob.glob(os.path.join(sys.argv[1],'*.mp3'))}
    c=[k for k in d if k in b]
    print(f'同 id 对比 ({len(c)} 句): 之前 {statistics.mean(b[k] for k in c):.2f}s → 现在 {statistics.mean(d[k] for k in c):.2f}s')
