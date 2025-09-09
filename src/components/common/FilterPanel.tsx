'use client';

import React from 'react';
import { Card, Space, Input, Select, Button } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';

const { Option } = Select;

export interface FilterOption {
  key: string;
  label: string;
  type: 'input' | 'select';
  placeholder?: string;
  options?: Array<{ value: string; label: string }>;
  style?: React.CSSProperties;
  allowClear?: boolean;
}

export interface FilterPanelProps {
  title?: string;
  filters: Record<string, string>;
  filterOptions: FilterOption[];
  onFilterChange: (key: string, value: string) => void;
  onReset: () => void;
  showResetButton?: boolean;
  showRefreshButton?: boolean;
  onRefresh?: () => void;
  resultCount?: number;
  style?: React.CSSProperties;
  size?: 'small' | 'default';
}

const FilterPanel: React.FC<FilterPanelProps> = ({
  title = '筛选条件',
  filters,
  filterOptions,
  onFilterChange,
  onReset,
  showResetButton = true,
  showRefreshButton = false,
  onRefresh,
  resultCount,
  style,
  size = 'small'
}) => {
  const renderFilterItem = (option: FilterOption) => {
    const { key, label, type, placeholder, options, style: itemStyle, allowClear = true } = option;

    if (type === 'input') {
      return (
        <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ minWidth: 'auto', whiteSpace: 'nowrap', fontSize: '14px', color: '#666' }}>
            {label}:
          </span>
          <Input
            placeholder={placeholder}
            value={filters[key] || ''}
            onChange={(e) => onFilterChange(key, e.target.value)}
            style={{ ...itemStyle }}
            allowClear={allowClear}
          />
        </div>
      );
    }

    if (type === 'select') {
      return (
        <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ minWidth: 'auto', whiteSpace: 'nowrap', fontSize: '14px', color: '#666' }}>
            {label}:
          </span>
          <Select
            placeholder={placeholder}
            value={filters[key] || undefined}
            onChange={(value) => onFilterChange(key, value || '')}
            style={{ ...itemStyle }}
            allowClear={allowClear}
          >
            {options?.map(opt => (
              <Option key={opt.value} value={opt.value}>
                {opt.label}
              </Option>
            ))}
          </Select>
        </div>
      );
    }

    return null;
  };

  return (
    <Card 
      size={size}
      style={{ 
        marginBottom: 16, 
        backgroundColor: '#fafafa',
        ...style 
      }}
      title={title}
    >
      <Space wrap size="middle">
        {filterOptions.map(renderFilterItem)}
        
        {showResetButton && (
          <Button onClick={onReset}>
            重置筛选
          </Button>
        )}
        
        {showRefreshButton && onRefresh && (
          <Button 
            icon={<ReloadOutlined />}
            onClick={onRefresh}
          >
            刷新
          </Button>
        )}
        
        {resultCount !== undefined && (
          <span style={{ color: '#666', fontSize: '14px' }}>
            共 {resultCount} 条记录
          </span>
        )}
      </Space>
    </Card>
  );
};

export default FilterPanel;
