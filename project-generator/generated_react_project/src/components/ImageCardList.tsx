import React, { useState, useMemo } from 'react'
import { List, Card, Image, Button, Checkbox } from 'antd'
import { EyeOutlined } from '@ant-design/icons'
import type { CheckboxChangeEvent } from 'antd/es/checkbox'
import './ImageCardList.css'

interface CardDataItem {
  id: number
  imageUrl: string
  text: string
}

// Generating initial data
const initialCardData = Array.from({ length: 20 }, (_, i) => ({
  id: i + 1,
  imageUrl: `https://picsum.photos/seed/${i + 1}/400/300`,
  text:
    (i + 1) % 3 === 0
      ? `这是第 ${i + 1} 张卡片的描述文字，这段文字比较长，用来测试多行文本的情况。`
      : `卡片 ${i + 1} 的描述`,
}))

const ImageCardList: React.FC = () => {
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set())
  const [preview, setPreview] = useState<{ visible: boolean; src: string }>({
    visible: false,
    src: '',
  })

  const isAllSelected = useMemo(
    () => selectedItems.size === initialCardData.length && initialCardData.length > 0,
    [selectedItems.size],
  )

  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedItems(new Set())
    } else {
      const allIds = new Set(initialCardData.map((item) => item.id))
      setSelectedItems(allIds)
    }
  }

  const handleToggleSelection = (id: number) => {
    const newSelectedItems = new Set(selectedItems)
    if (newSelectedItems.has(id)) {
      newSelectedItems.delete(id)
    } else {
      newSelectedItems.add(id)
    }
    setSelectedItems(newSelectedItems)
  }
  
  const handleCheckboxChange = (e: CheckboxChangeEvent, id: number) => {
    // Stop propagation to prevent card click
    e.stopPropagation()
    handleToggleSelection(id)
  }

  const openPreview = (e: React.MouseEvent, src: string) => {
    e.stopPropagation()
    setPreview({ visible: true, src })
  }

  return (
    <div className="card-list-container">
      <Button onClick={handleToggleSelectAll} className="select-all-button">
        {isAllSelected ? '取消全选' : '全选'}
      </Button>
      
      <List
        grid={{ gutter: 16, xs: 1, sm: 2, md: 4, lg: 5, xl: 5, xxl: 5 }}
        dataSource={initialCardData}
        renderItem={(item: CardDataItem) => {
          const isSelected = selectedItems.has(item.id)
          return (
            <List.Item>
              <Card
                hoverable
                className="custom-card"
                bodyStyle={{ padding: 0, height: '100%' }}
                onClick={() => handleToggleSelection(item.id)}
              >
                <div className="card-wrapper">
                  <div className="image-container">
                    <Checkbox
                      className="select-checkbox"
                      checked={isSelected}
                      onChange={(e) => handleCheckboxChange(e, item.id)}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <Image
                      src={item.imageUrl}
                      preview={false}
                      className="card-image"
                      alt={item.text}
                    />
                    <div
                      className="eye-icon"
                      onClick={(e) => openPreview(e, item.imageUrl)}
                    >
                      <EyeOutlined />
                    </div>
                  </div>
                  <div className="text-content">
                    <p>{item.text}</p>
                  </div>
                </div>
              </Card>
            </List.Item>
          )
        }}
      />
      
      <div style={{ display: 'none' }}>
        <Image.PreviewGroup
          preview={{
            visible: preview.visible,
            onVisibleChange: (vis) => setPreview({ ...preview, visible: vis }),
            current: 0,
            items: [preview.src]
          }}
        >
           <Image src={preview.src} />
        </Image.PreviewGroup>
      </div>
    </div>
  )
}

export default ImageCardList