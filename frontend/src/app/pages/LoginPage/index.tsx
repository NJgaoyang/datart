/**
 * Datart
 *
 * Copyright 2021
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {
  selectLoggedInUser,
  selectLoginLoading,
  selectOauth2Clients,
  selectSystemInfo,
} from 'app/slice/selectors';
import { getOauth2Clients, login } from 'app/slice/thunks';
import React, { useCallback, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import styled, { keyframes } from 'styled-components';
import { LoginForm } from './LoginForm';

// 使用 public/static 目录下的 logo（路径以 /static 开头，能通过后端拦截器白名单）
const logoPath = '/static/logo.png';

// ============ 动画 ============
const float = keyframes`
  0%, 100% { transform: translateY(0) rotate(0deg); }
  33% { transform: translateY(-20px) rotate(2deg); }
  66% { transform: translateY(10px) rotate(-1deg); }
`;

const slideUp = keyframes`
  from { opacity: 0; transform: translateY(40px); }
  to { opacity: 1; transform: translateY(0); }
`;

const fadeIn = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`;

const gradientMove = keyframes`
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
`;

const dataFlow = keyframes`
  0% { opacity: 0; transform: translateX(-100%); }
  20% { opacity: 1; }
  80% { opacity: 1; }
  100% { opacity: 0; transform: translateX(100%); }
`;

const barGrow = keyframes`
  from { height: 0; opacity: 0; }
  to { opacity: 1; }
`;

export function LoginPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const systemInfo = useSelector(selectSystemInfo);
  const loading = useSelector(selectLoginLoading);
  const loggedInUser = useSelector(selectLoggedInUser);
  const oauth2Clients = useSelector(selectOauth2Clients);

  useEffect(() => {
    dispatch(getOauth2Clients());
  }, [dispatch]);

  const onLogin = useCallback(
    values => {
      dispatch(
        login({
          params: values,
          resolve: () => {
            navigate('/', { replace: true });
          },
        }),
      );
    },
    [dispatch, navigate],
  );

  return (
    <PageContainer>
      {/* 动态背景 */}
      <BackgroundLayer>
        <GradientBg />
        <ParticleField>
          {[...Array(25)].map((_, i) => (
            <Particle key={i} index={i} />
          ))}
        </ParticleField>
        <DataLines>
          {[...Array(6)].map((_, i) => (
            <DataLine key={i} index={i} />
          ))}
        </DataLines>
      </BackgroundLayer>

      {/* 主内容 - 使用 vw/vh 相对单位实现真正的自适应 */}
      <ContentLayer>
        {/* 左侧品牌展示区 */}
        <BrandSection>
          <BrandContent>
            <BrandHeader>
              <BrandIcon>
                <svg viewBox="0 0 80 80" fill="none">
                  <rect x="8" y="32" width="12" height="40" rx="4" fill="rgba(255,255,255,0.9)" />
                  <rect x="24" y="20" width="12" height="52" rx="4" fill="rgba(255,255,255,0.8)" />
                  <rect x="40" y="8" width="12" height="64" rx="4" fill="rgba(255,255,255,0.7)" />
                  <rect x="56" y="24" width="12" height="48" rx="4" fill="rgba(255,255,255,0.6)" />
                </svg>
              </BrandIcon>
              <BrandTitle>数据洞察，智启未来</BrandTitle>
              <BrandSubtitle>企业级商业智能分析平台</BrandSubtitle>
            </BrandHeader>

            {/* 图表展示区 */}
            <ChartsGrid>
              <ChartCard>
                <ChartHeader>
                  <ChartTitle>月度营收趋势</ChartTitle>
                  <ChartBadge>+23.5%</ChartBadge>
                </ChartHeader>
                <BarChart>
                  {[65, 78, 90, 85, 95, 88, 100].map((h, i) => (
                    <Bar key={i} height={h} delay={i * 0.1} />
                  ))}
                </BarChart>
              </ChartCard>

              <ChartCard>
                <ChartHeader>
                  <ChartTitle>用户活跃度</ChartTitle>
                  <ChartBadge>+18.2%</ChartBadge>
                </ChartHeader>
                <LineChart>
                  <svg viewBox="0 0 200 80" preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="lineGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#a5b4fc" stopOpacity="0.4" />
                      <stop offset="100%" stopColor="#a5b4fc" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <path d="M0,60 L30,45 L60,55 L90,30 L120,40 L150,20 L180,35 L200,15 L200,80 L0,80 Z" fill="url(#lineGrad)" />
                    <path d="M0,60 L30,45 L60,55 L90,30 L120,40 L150,20 L180,35 L200,15" fill="none" stroke="#a5b4fc" strokeWidth="2.5" strokeLinecap="round" />
                  </svg>
                </LineChart>
              </ChartCard>
            </ChartsGrid>

            {/* 统计卡片 */}
            <StatsRow>
              <StatItem>
                <StatNumber>12.8K</StatNumber>
                <StatLabel>数据源接入</StatLabel>
                <StatBar>
                  <StatBarFill width={75} />
                </StatBar>
              </StatItem>
              <StatItem>
                <StatNumber>99.9%</StatNumber>
                <StatLabel>系统可用性</StatLabel>
                <StatBar>
                  <StatBarFill width={99} />
                </StatBar>
              </StatItem>
              <StatItem>
                <StatNumber>50+</StatNumber>
                <StatLabel>图表组件</StatLabel>
                <StatBar>
                  <StatBarFill width={60} />
                </StatBar>
              </StatItem>
            </StatsRow>

            {/* 功能特性 */}
            <FeatureList>
              <FeatureItem>
                <FeatureDot />
                <span>多维数据可视化分析</span>
              </FeatureItem>
              <FeatureItem>
                <FeatureDot />
                <span>实时数据监控大屏</span>
              </FeatureItem>
              <FeatureItem>
                <FeatureDot />
                <span>智能报表自动生成</span>
              </FeatureItem>
            </FeatureList>
          </BrandContent>
        </BrandSection>

        {/* 右侧登录区 */}
        <LoginSection>
          <LoginCard>
            <CardHeader>
              <LogoWrapper>
                <LogoImg src={logoPath} alt="logo" />
              </LogoWrapper>
              <SystemName>宜租乐 BI</SystemName>
            </CardHeader>
            <LoginForm
              loading={loading}
              loggedInUser={loggedInUser}
              oauth2Clients={oauth2Clients}
              registerEnable={systemInfo?.registerEnable}
              onLogin={onLogin}
            />
            <CardFooter>
              <FooterText>© 2026 宜租乐科技 · 数据驱动业务增长</FooterText>
            </CardFooter>
          </LoginCard>
        </LoginSection>
      </ContentLayer>
    </PageContainer>
  );
}

// ============ 样式 ============

/* 所有尺寸使用 vw/vh 相对单位，天然适配任何分辨率 */

const PageContainer = styled.div`
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  overflow: hidden;
`;

const BackgroundLayer = styled.div`
  position: absolute;
  inset: 0;
  z-index: 0;
`;

const GradientBg = styled.div`
  position: absolute;
  inset: 0;
  background: linear-gradient(-45deg, #1a1040, #3b2d80, #2d2460, #201a4a);
  background-size: 400% 400%;
  animation: ${gradientMove} 20s ease infinite;
`;

const ParticleField = styled.div`
  position: absolute;
  inset: 0;
  overflow: hidden;
`;

const Particle = styled.div<{ index: number }>`
  position: absolute;
  top: ${p => (p.index * 5) % 100}%;
  left: ${p => (p.index * 4) % 100}%;
  width: ${p => 4 + (p.index % 6) * 2}px;
  height: ${p => 4 + (p.index % 6) * 2}px;
  background: rgba(129, 140, 248, ${p => 0.25 + (p.index % 5) * 0.1});
  border-radius: 50%;
  animation: ${float} ${p => 8 + (p.index % 8) * 2}s ease-in-out infinite;
  animation-delay: ${p => (p.index % 6) * -1.5}s;
`;

const DataLines = styled.div`
  position: absolute;
  inset: 0;
  overflow: hidden;
  opacity: 0.25;
`;

const DataLine = styled.div<{ index: number }>`
  position: absolute;
  top: ${p => 15 + p.index * 14}%;
  width: ${p => 180 + p.index * 40}px;
  height: 2px;
  background: linear-gradient(90deg, transparent, #818cf8, transparent);
  animation: ${dataFlow} ${p => 5 + p.index * 1.5}s linear infinite;
  animation-delay: ${p => p.index * -1.8}s;
`;

/* 主内容层：vw/vh 全铺满，flex 弹性布局 */
const ContentLayer = styled.div`
  position: relative;
  z-index: 1;
  box-sizing: border-box;
  display: flex;
  gap: clamp(20px, 3vw, 50px);
  align-items: center;
  justify-content: center;
  width: 100vw;
  height: 100vh;
  padding: clamp(16px, 2.5vh, 40px) clamp(20px, 3.5vw, 60px);
`;

/* 左侧品牌区：flex 1.2 占比 */
const BrandSection = styled.div`
  display: flex;
  flex: 1.2;
  align-items: center;
  justify-content: center;
  min-width: 0;
  animation: ${fadeIn} 1s ease-out;
`;

const BrandContent = styled.div`
  width: 100%;
  max-width: 620px;
  color: white;
`;

const BrandHeader = styled.div`
  margin-bottom: clamp(12px, 2vh, 28px);
`;

const BrandIcon = styled.div`
  width: clamp(48px, 5vw, 80px);
  height: clamp(48px, 5vw, 80px);
  margin-bottom: clamp(12px, 2vh, 28px);
  animation: ${float} 6s ease-in-out infinite;
`;

const BrandTitle = styled.h1`
  margin: 0 0 clamp(8px, 1.2vh, 20px);
  font-size: clamp(24px, 2.8vw, 48px);
  font-weight: 700;
  line-height: 1.2;
  background: linear-gradient(135deg, #fff 0%, #c7d2fe 100%);
  background-clip: text;
  -webkit-text-fill-color: transparent;
`;

const BrandSubtitle = styled.p`
  margin: 0;
  font-size: clamp(12px, 1vw, 18px);
  color: rgba(255, 255, 255, 0.8);
  letter-spacing: 2px;
`;

const ChartsGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: clamp(8px, 0.8vw, 16px);
  margin-bottom: clamp(10px, 1.5vh, 20px);
`;

const ChartCard = styled.div`
  padding: clamp(10px, 1vw, 18px);
  background: rgba(255, 255, 255, 0.12);
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: clamp(10px, 1vw, 16px);
  transition: all 0.3s ease;
  backdrop-filter: blur(12px);

  &:hover {
    background: rgba(255, 255, 255, 0.18);
    border-color: rgba(129, 140, 248, 0.4);
  }
`;

const ChartHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: clamp(8px, 1vh, 14px);
`;

const ChartTitle = styled.span`
  font-size: clamp(11px, 0.8vw, 14px);
  font-weight: 500;
  color: rgba(255, 255, 255, 0.85);
`;

const ChartBadge = styled.span`
  padding: clamp(2px, 0.2vw, 4px) clamp(6px, 0.5vw, 10px);
  font-size: clamp(10px, 0.7vw, 12px);
  font-weight: 600;
  color: #4ade80;
  background: rgba(52, 211, 153, 0.25);
  border-radius: 4px;
`;

const BarChart = styled.div`
  display: flex;
  gap: clamp(4px, 0.4vw, 8px);
  align-items: flex-end;
  height: clamp(40px, 6vh, 80px);
`;

const Bar = styled.div<{ height: number; delay: number }>`
  flex: 1;
  height: ${p => p.height}%;
  background: linear-gradient(180deg, #a5b4fc 0%, #818cf8 100%);
  border-radius: 3px 3px 0 0;
  animation: ${barGrow} 0.8s ease-out ${p => p.delay}s both;
`;

const LineChart = styled.div`
  height: clamp(40px, 6vh, 80px);

  svg {
    width: 100%;
    height: 100%;
  }
`;

const StatsRow = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: clamp(8px, 0.8vw, 14px);
  margin-bottom: clamp(12px, 1.8vh, 24px);
`;

const StatItem = styled.div`
  padding: clamp(10px, 0.8vw, 16px);
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: clamp(8px, 0.8vw, 14px);
  transition: all 0.3s ease;

  &:hover {
    background: rgba(255, 255, 255, 0.16);
    transform: translateY(-2px);
  }
`;

const StatNumber = styled.div`
  margin-bottom: 2px;
  font-size: clamp(16px, 1.4vw, 24px);
  font-weight: 700;
  color: #fff;
`;

const StatLabel = styled.div`
  margin-bottom: clamp(6px, 0.8vh, 10px);
  font-size: clamp(10px, 0.7vw, 12px);
  color: rgba(255, 255, 255, 0.65);
`;

const StatBar = styled.div`
  height: 3px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.18);
  border-radius: 2px;
`;

const StatBarFill = styled.div<{ width: number }>`
  width: ${p => p.width}%;
  height: 100%;
  background: linear-gradient(90deg, #818cf8, #a5b4fc);
  border-radius: 2px;
  animation: ${slideUp} 1s ease-out 0.5s both;
`;

const FeatureList = styled.div`
  display: flex;
  flex-direction: column;
  gap: clamp(8px, 1vh, 16px);
`;

const FeatureItem = styled.div`
  display: flex;
  gap: clamp(8px, 0.6vw, 12px);
  align-items: center;
  font-size: clamp(12px, 0.9vw, 16px);
  color: rgba(255, 255, 255, 0.9);
`;

const FeatureDot = styled.div`
  flex-shrink: 0;
  width: 6px;
  height: 6px;
  background: #818cf8;
  border-radius: 50%;
  box-shadow: 0 0 12px rgba(129, 140, 248, 0.8);
`;

/* 右侧登录区：flex 0.8 占比 */
const LoginSection = styled.div`
  display: flex;
  flex: 0.8;
  align-items: center;
  justify-content: center;
  min-width: 0;
  animation: ${slideUp} 0.8s ease-out;
`;

const LoginCard = styled.div`
  width: 100%;
  max-width: clamp(320px, 25vw, 460px);
  padding: clamp(24px, 3vh, 48px) clamp(24px, 2vw, 44px);
  background: rgba(255, 255, 255, 0.15);
  border: 1px solid rgba(255, 255, 255, 0.25);
  border-radius: clamp(16px, 1.5vw, 28px);
  box-shadow: 0 25px 60px rgba(0, 0, 0, 0.35);
  transition: all 0.3s ease;
  backdrop-filter: blur(28px);

  &:hover {
    box-shadow: 0 30px 70px rgba(0, 0, 0, 0.4);
  }
`;

const CardHeader = styled.div`
  margin-bottom: clamp(20px, 3vh, 36px);
  text-align: center;
`;

const LogoWrapper = styled.div`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: clamp(64px, 5vw, 96px);
  height: clamp(64px, 5vw, 96px);
  margin-bottom: clamp(10px, 1.5vh, 20px);
  background: transparent;
  border-radius: clamp(12px, 1.2vw, 20px);
`;

const LogoImg = styled.img`
  width: clamp(48px, 3.5vw, 72px);
  height: clamp(48px, 3.5vw, 72px);
  object-fit: contain;
`;

const SystemName = styled.h2`
  margin: 0 0 clamp(4px, 0.6vh, 8px);
  font-size: clamp(20px, 1.5vw, 28px);
  font-weight: 700;
  color: #fff;
`;

const CardFooter = styled.div`
  margin-top: clamp(16px, 2.5vh, 32px);
  text-align: center;
`;

const FooterText = styled.p`
  margin: 0;
  font-size: clamp(10px, 0.7vw, 12px);
  color: rgba(255, 255, 255, 0.4);
`;
