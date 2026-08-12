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
  selectSystemInfo,
} from 'app/slice/selectors';
import { login } from 'app/slice/thunks';
import React, { useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import styled, { keyframes } from 'styled-components';
import { LoginFormLight } from './LoginFormLight';

// 使用 public/static 目录下的 logo（路径以 /static 开头，能通过后端拦截器白名单）
const logoPath = '/static/logo.png';

// ============ 动画 ============
const fadeInUp = keyframes`
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
`;

const float = keyframes`
  0%, 100% { transform: translateY(0) rotate(0deg); }
  33% { transform: translateY(-10px) rotate(1deg); }
  66% { transform: translateY(5px) rotate(-1deg); }
`;

const pulseSlow = keyframes`
  0%, 100% { opacity: 0.6; }
  50% { opacity: 0.8; }
`;

const gradientShift = keyframes`
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
`;

export function LoginPageLight() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const systemInfo = useSelector(selectSystemInfo);
  const loading = useSelector(selectLoginLoading);
  const loggedInUser = useSelector(selectLoggedInUser);

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
      {/* 左侧品牌展示区 */}
      <BrandSection>
        <BrandBackground>
          <GradientBg />
          <PulseCircle1 />
          <PulseCircle2 />
        </BrandBackground>

        <BrandContent>
          {/* 品牌图标 */}
          <BrandIcon aria-hidden="true">
            <svg viewBox="0 0 80 80" fill="none" aria-hidden="true">
              <rect
                x="8"
                y="32"
                width="12"
                height="40"
                rx="4"
                fill="currentColor"
                opacity="0.9"
              />
              <rect
                x="24"
                y="20"
                width="12"
                height="52"
                rx="4"
                fill="currentColor"
                opacity="0.8"
              />
              <rect
                x="40"
                y="8"
                width="12"
                height="64"
                rx="4"
                fill="currentColor"
                opacity="0.7"
              />
              <rect
                x="56"
                y="24"
                width="12"
                height="48"
                rx="4"
                fill="currentColor"
                opacity="0.6"
              />
            </svg>
          </BrandIcon>

          {/* 品牌标题 */}
          <BrandTitle>数据洞察，智启未来</BrandTitle>
          <BrandSubtitle>企业级商业智能分析平台</BrandSubtitle>

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
                    <linearGradient
                      id="lineGrad"
                      x1="0%"
                      y1="0%"
                      x2="0%"
                      y2="100%"
                    >
                      <stop offset="0%" stopColor="#93C5FD" stopOpacity="0.4" />
                      <stop offset="100%" stopColor="#93C5FD" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path
                    d="M0,60 L30,45 L60,55 L90,30 L120,40 L150,20 L180,35 L200,15 L200,80 L0,80 Z"
                    fill="url(#lineGrad)"
                  />
                  <path
                    d="M0,60 L30,45 L60,55 L90,30 L120,40 L150,20 L180,35 L200,15"
                    fill="none"
                    stroke="#3B82F6"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
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
          <LoginFormLight
            loading={loading}
            loggedInUser={loggedInUser}
            registerEnable={systemInfo?.registerEnable}
            onLogin={onLogin}
          />
          <CardFooter>
            <FooterText>© 2026 宜租乐科技 · 数据驱动业务增长</FooterText>
          </CardFooter>
        </LoginCard>
      </LoginSection>
    </PageContainer>
  );
}

// ============ 样式 ============

/* 所有尺寸使用 vw/vh 相对单位，天然适配任何分辨率 */

const PageContainer = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  overflow: hidden;
  display: flex;
  background: #f8fafc;
  font-family: 'DM Sans', -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue',
    Arial, 'Noto Sans', sans-serif;
`;

/* 左侧品牌区 */
const BrandSection = styled.div`
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
  min-width: 0;

  @media (max-width: 1024px) {
    display: none;
  }
`;

const BrandBackground = styled.div`
  position: absolute;
  inset: 0;
  z-index: 0;
`;

const GradientBg = styled.div`
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 50%, #bfdbfe 100%);
  background-size: 200% 200%;
  animation: ${gradientShift} 8s ease infinite;
`;

const PulseCircle1 = styled.div`
  position: absolute;
  top: 5rem;
  left: 5rem;
  width: 16rem;
  height: 16rem;
  background: #bfdbfe;
  border-radius: 50%;
  filter: blur(80px);
  opacity: 0.2;
  animation: ${pulseSlow} 4s ease-in-out infinite;
`;

const PulseCircle2 = styled.div`
  position: absolute;
  bottom: 5rem;
  right: 5rem;
  width: 12rem;
  height: 12rem;
  background: #93c5fd;
  border-radius: 50%;
  filter: blur(80px);
  opacity: 0.15;
  animation: ${pulseSlow} 4s ease-in-out infinite 2s;
`;

const BrandContent = styled.div`
  position: relative;
  z-index: 1;
  max-width: 620px;
  padding: 2rem;
`;

const BrandIcon = styled.div`
  width: clamp(48px, 5vw, 80px);
  height: clamp(48px, 5vw, 80px);
  margin-bottom: clamp(12px, 2vh, 28px);
  animation: ${float} 6s ease-in-out infinite;
  color: #2563eb;
`;

const BrandTitle = styled.h1`
  font-size: clamp(24px, 2.8vw, 48px);
  font-weight: 700;
  margin: 0 0 clamp(8px, 1.2vh, 20px);
  color: #1e293b;
  line-height: 1.2;
  font-family: 'Plus Jakarta Sans', sans-serif;
`;

const BrandSubtitle = styled.p`
  font-size: clamp(12px, 1vw, 18px);
  color: #64748b;
  margin: 0;
  letter-spacing: 2px;
`;

const ChartsGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: clamp(8px, 0.8vw, 16px);
  margin-bottom: clamp(10px, 1.5vh, 20px);
`;

const ChartCard = styled.div`
  background: #ffffff;
  border-radius: clamp(10px, 1vw, 16px);
  border: 1px solid #e2e8f0;
  padding: clamp(10px, 1vw, 18px);
  transition: all 0.3s ease;
  box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1);

  &:hover {
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1),
      0 2px 4px -2px rgba(0, 0, 0, 0.1);
    border-color: #bfdbfe;
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
  color: #64748b;
  font-weight: 500;
`;

const ChartBadge = styled.span`
  font-size: clamp(10px, 0.7vw, 12px);
  color: #16a34a;
  background: #f0fdf4;
  padding: clamp(2px, 0.2vw, 4px) clamp(6px, 0.5vw, 10px);
  border-radius: 4px;
  font-weight: 600;
`;

const BarChart = styled.div`
  display: flex;
  align-items: flex-end;
  gap: clamp(4px, 0.4vw, 8px);
  height: clamp(40px, 6vh, 80px);
`;

const Bar = styled.div<{ height: number; delay: number }>`
  flex: 1;
  height: ${p => p.height}%;
  background: linear-gradient(180deg, #93c5fd 0%, #3b82f6 100%);
  border-radius: 3px 3px 0 0;
  animation: ${fadeInUp} 0.8s ease-out ${p => p.delay}s both;
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
  background: #ffffff;
  border-radius: clamp(8px, 0.8vw, 14px);
  border: 1px solid #e2e8f0;
  padding: clamp(10px, 0.8vw, 16px);
  transition: all 0.3s ease;
  box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1);

  &:hover {
    border-color: #bfdbfe;
    transform: translateY(-2px);
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1),
      0 2px 4px -2px rgba(0, 0, 0, 0.1);
  }
`;

const StatNumber = styled.div`
  font-size: clamp(16px, 1.4vw, 24px);
  font-weight: 700;
  color: #1e293b;
  margin-bottom: 2px;
`;

const StatLabel = styled.div`
  font-size: clamp(10px, 0.7vw, 12px);
  color: #64748b;
  margin-bottom: clamp(6px, 0.8vh, 10px);
`;

const StatBar = styled.div`
  height: 3px;
  background: #e2e8f0;
  border-radius: 2px;
  overflow: hidden;
`;

const StatBarFill = styled.div<{ width: number }>`
  height: 100%;
  width: ${p => p.width}%;
  background: linear-gradient(90deg, #3b82f6, #2563eb);
  border-radius: 2px;
  animation: ${fadeInUp} 1s ease-out 0.5s both;
`;

const FeatureList = styled.div`
  display: flex;
  flex-direction: column;
  gap: clamp(8px, 1vh, 16px);
`;

const FeatureItem = styled.div`
  display: flex;
  align-items: center;
  gap: clamp(8px, 0.6vw, 12px);
  font-size: clamp(12px, 0.9vw, 16px);
  color: #64748b;
`;

const FeatureDot = styled.div`
  width: 6px;
  height: 6px;
  background: #3b82f6;
  border-radius: 50%;
  box-shadow: 0 0 12px rgba(59, 130, 246, 0.5);
  flex-shrink: 0;
`;

/* 右侧登录区 */
const LoginSection = styled.div`
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  animation: ${fadeInUp} 0.8s ease-out;
  min-width: 0;
  padding: clamp(20px, 3vh, 48px) clamp(24px, 4vw, 72px);

  @media (max-width: 1024px) {
    flex: 1;
  }
`;

const LoginCard = styled.div`
  width: 100%;
  max-width: clamp(400px, 30vw, 560px);
  background: #ffffff;
  border-radius: clamp(20px, 1.8vw, 32px);
  border: 1px solid #e2e8f0;
  padding: clamp(32px, 4vh, 60px) clamp(32px, 2.8vw, 56px);
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
  transition: all 0.3s ease;

  &:hover {
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.3);
  }
`;

const CardHeader = styled.div`
  text-align: center;
  margin-bottom: clamp(24px, 3.5vh, 44px);
`;

const LogoWrapper = styled.div`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: clamp(80px, 6vw, 120px);
  height: clamp(80px, 6vw, 120px);
  background: transparent;
  border-radius: clamp(16px, 1.5vw, 24px);
  margin-bottom: clamp(12px, 1.8vh, 24px);
`;

const LogoImg = styled.img`
  width: clamp(60px, 4.5vw, 90px);
  height: clamp(60px, 4.5vw, 90px);
  object-fit: contain;
`;

const SystemName = styled.h2`
  font-size: clamp(24px, 1.8vw, 34px);
  font-weight: 700;
  color: #1e293b;
  margin: 0 0 clamp(4px, 0.6vh, 8px);
  font-family: 'Plus Jakarta Sans', sans-serif;
`;

const CardFooter = styled.div`
  margin-top: clamp(20px, 3vh, 40px);
  text-align: center;
`;

const FooterText = styled.p`
  font-size: clamp(11px, 0.75vw, 13px);
  color: #94a3b8;
  margin: 0;
`;
