---
title: KMS 激活(Windows & Office)
createTime: 2025/01/10 17:50:39
permalink: /notes/q5w629t0/
---

## 前言

最近突然发现 windows 激活过期了，恰好发现一种激活方式，简单有效，遂记录。

KMS的正式名称为Microsoft 通用批量许可证密钥 (GVLK)，是微软提供给企业内部用户的激活系统的方式，区别于零售版。通过KMS激活的系统与零售版功能上无任何区分，唯一要注意的就是激活最长180天有效，需要保证网络连接以自动续期。

## 1. 一键激活

[https://kms.cx](https://kms.cx)

## 2. 手动激活

[KMS 激活参考](https://github.com/netnr/kms)、[密钥合集](https://github.com/xiaozhu2021/key)。如果不放心别人的 KMS 服务器，也可以搭建一个自己的 KMS 服务器，非常简单。  
在`OpenWrt`系统下安装`vlmcsd`、`luci-app-vlmcsd`、`luci-i18n-vlmcsd-zh-cn`软件包即可。

## 3. 永久激活(推荐)

不同于 KMS，[MAS激活](https://github.com/massgravel/Microsoft-Activation-Scripts)会写入一个永久密钥，无需 180 天续签。
