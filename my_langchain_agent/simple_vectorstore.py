import uuid
import os
from typing import List, Dict
import numpy as np

# 导入 HuggingFaceEmbeddings
from langchain_community.embeddings import HuggingFaceEmbeddings

class SimpleVectorStore:
    """
    一个使用 HuggingFace Embeddings 的简易内存向量数据库实现。
    它会为文本生成真实的向量嵌入，并使用余弦相似度进行搜索。
    """
    def __init__(self):
        # 这里可以自定义模型名称，默认用 sentence-transformers/all-MiniLM-L6-v2
        self.embeddings_model = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")
        self.documents = []  # 存储 {'id': '...', 'text': '...', 'embedding': np.array([...])}

    def _get_embedding(self, text: str) -> np.ndarray:
        """
        使用 HuggingFace Embeddings 模型获取文本的向量嵌入。
        """
        return np.array(self.embeddings_model.embed_query(text))

    def add_documents(self, texts: List[str]):
        """
        添加文本到向量数据库，并为每个文本生成嵌入。
        """
        for text in texts:
            doc_id = str(uuid.uuid4())
            embedding = self._get_embedding(text)
            self.documents.append({'id': doc_id, 'text': text, 'embedding': embedding})
        print(f"已添加 {len(texts)} 篇文档到简易向量数据库并生成嵌入。")

    def similarity_search(self, query: str, k: int = 4) -> List[Dict]:
        """
        基于余弦相似度执行向量搜索。
        """
        if not self.documents:
            print("向量数据库为空，无法执行搜索。")
            return []

        query_embedding = self._get_embedding(query)
        
        similarities = []
        for doc in self.documents:
            doc_embedding = doc['embedding']
            # 计算余弦相似度
            # cosine_similarity = (A . B) / (||A|| * ||B||)
            dot_product = np.dot(query_embedding, doc_embedding)
            norm_a = np.linalg.norm(query_embedding)
            norm_b = np.linalg.norm(doc_embedding)
            
            if norm_a == 0 or norm_b == 0:
                similarity = 0.0 # 避免除以零
            else:
                similarity = dot_product / (norm_a * norm_b)
            
            similarities.append((similarity, doc['text']))
        
        # 按相似度降序排序
        similarities.sort(key=lambda x: x[0], reverse=True)
        
        # 返回前 k 个最相似的文档文本
        return [{'text': text, 'similarity': sim} for sim, text in similarities[:k]]

    def get_all_documents(self) -> List[Dict]:
        """
        返回所有存储的文档。
        """
        # 返回时，不包含嵌入数据，避免大量输出
        return [{'id': doc['id'], 'text': doc['text']} for doc in self.documents]

    def clear(self):
        """
        清空向量数据库。
        """
        self.documents = []
        print("简易向量数据库已清空。")

if __name__ == "__main__":
    # 示例用法
    # 确保在运行此示例之前设置了 DEEPSEEK_API_KEY 环境变量
    # 例如：os.environ["DEEPSEEK_API_KEY"] = "YOUR_DEEPSEEK_API_KEY"
    
    try:
        vector_store = SimpleVectorStore()

        # 添加文档
        vector_store.add_documents([
            "Langchain 是一个用于开发由语言模型驱动的应用程序的框架。",
            "向量数据库用于存储和检索高维向量数据。",
            "Python 是一种流行的编程语言，广泛应用于人工智能和数据科学。",
            "本篇文章讨论了大型语言模型（LLM）的最新进展。",
            "机器学习是人工智能的一个子领域。",
            "数据科学结合了统计学、计算机科学和领域知识。"
        ])

        print("\n所有文档 (仅显示文本):")
        for doc in vector_store.get_all_documents():
            print(f"- {doc['text']}")

        # 执行相似度搜索
        query_text = "LLM 的框架"
        found_docs = vector_store.similarity_search(query_text, k=2)
        print(f"\n与查询 '{query_text}' 最相似的文档 (前2个):")
        if found_docs:
            for doc_info in found_docs:
                print(f"- 文本: {doc_info['text']}, 相似度: {doc_info['similarity']:.4f}")
        else:
            print("未找到相似文档。")
        
        query_text = "编程和数据分析"
        found_docs = vector_store.similarity_search(query_text, k=1)
        print(f"\n与查询 '{query_text}' 最相似的文档 (前1个):")
        if found_docs:
            for doc_info in found_docs:
                print(f"- 文本: {doc_info['text']}, 相似度: {doc_info['similarity']:.4f}")
        else:
            print("未找到相似文档。")
        
        # 清空数据库
        vector_store.clear()
        print("\n清空后所有文档:")
        print(vector_store.get_all_documents())

    except ValueError as e:
        print(f"错误: {e}")
    except Exception as e:
        print(f"发生错误: {e}") 