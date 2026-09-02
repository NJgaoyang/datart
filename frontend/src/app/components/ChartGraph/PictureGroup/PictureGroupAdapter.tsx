import React, { useState } from 'react';
import styled from 'styled-components';

const Grid = styled.div<{ columns: number }>`
  display: grid;
  grid-template-columns: repeat(${p => p.columns}, minmax(0, 1fr));
  gap: 8px;
  width: 100%;
  height: 100%;
  overflow: auto;
`;
const Card = styled.div`
  min-width: 0;
  text-align: center;
`;
const Image = styled.img<{ fit: string; radius: number }>`
  width: 100%;
  height: 120px;
  object-fit: ${p => p.fit};
  border-radius: ${p => p.radius}px;
  background: #f1f3f5;
`;

const Placeholder = styled.div<{ radius: number }>`
  width: 100%;
  height: 120px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: ${p => p.radius}px;
  background: #f1f3f5;
  color: #868e96;
`;

function PictureItem({ item, fit, radius }: any) {
  const [failed, setFailed] = useState(false);
  return (
    <Card>
      {failed ? (
        <Placeholder radius={radius}>图片加载失败</Placeholder>
      ) : (
        <Image
          src={item.url}
          alt={item.label || ''}
          fit={fit}
          radius={radius}
          onError={() => setFailed(true)}
        />
      )}
      {item.label && <div>{item.label}</div>}
    </Card>
  );
}

export default function PictureGroupAdapter({
  items,
  columns = 4,
  fit = 'cover',
  radius = 4,
}: any) {
  return (
    <Grid columns={columns}>
      {(items || []).map((item, index) => (
        <PictureItem
          key={`${item.url}-${index}`}
          item={item}
          fit={fit}
          radius={radius}
        />
      ))}
    </Grid>
  );
}
