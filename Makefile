CC ?= gcc
CFLAGS ?= -O3 -std=c11 -Wall -Wextra -pthread -D_POSIX_C_SOURCE=200809L
PKG_CONFIG ?= pkg-config

PKGS = libavformat libavcodec libswscale libavutil libzstd

CFLAGS += $(shell $(PKG_CONFIG) --cflags $(PKGS))
LDLIBS += $(shell $(PKG_CONFIG) --libs $(PKGS)) -pthread -lm

TARGET = trace-moe-colorlayout
SRCS = src/native/main.c src/native/color_layout.c
OBJS = $(SRCS:.c=.o)

all: $(TARGET)

$(TARGET): $(OBJS)
	$(CC) $(OBJS) $(LDLIBS) -o $(TARGET)

%.o: %.c
	$(CC) $(CFLAGS) -c $< -o $@

clean:
	rm -f $(OBJS) $(TARGET)

.PHONY: all clean
