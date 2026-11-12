import json,sys,matplotlib
matplotlib.use('Agg');import matplotlib.pyplot as plt
d=json.load(open(sys.argv[1]));fig,ax=plt.subplots(5,1,figsize=(11,12))
for i,m in enumerate(d):
    r=d[m];t=[x[0] for x in r]
    ax[i].plot(t,[x[1] for x in r],label='dx px');ax[i].plot(t,[x[2] for x in r],label='dy px');ax[i].plot(t,[x[3]*10 for x in r],label='rot deg x10')
    ax[i].set_title(m);ax[i].legend(loc='right');ax[i].grid(alpha=.3)
plt.tight_layout();plt.savefig(sys.argv[2],dpi=70)
