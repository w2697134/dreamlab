import { NextRequest, NextResponse } from 'next/server';
import { 
  getSDInstances,
  checkSDAvailability,
  getAvailableInstances,
  selectSDTarget,
  validateSDConfig,
  addSDInstance,
  removeSDInstance,
  setPreferredInstance,
  SDInstance,
} from '@/lib/sd-config';

/**
 * SD 实例管理接口
 * 
 * GET: 获取所有SD实例列表和状态
 * POST: 检查实例可用性
 */

// 获取所有SD配置
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');
  
  if (action === 'check-all') {
    // 检查所有SD实例的可用性
    const instances = getSDInstances();
    const availableInstances = await getAvailableInstances();
    const availableIds = new Set(availableInstances.map(i => i.id));
    
    // 更新可用性状态
    const updatedInstances = instances.map(inst => ({
      ...inst,
      isAvailable: availableIds.has(inst.id),
    }));
    
    return NextResponse.json({
      success: true,
      instances: updatedInstances,
      availableCount: availableInstances.length,
    });
  }
  
  if (action === 'validate') {
    // 校验配置
    const { valid, errors } = validateSDConfig();
    return NextResponse.json({
      success: true,
      valid,
      errors,
    });
  }
  
  // 默认返回所有实例
  const instances = getSDInstances();
  
  return NextResponse.json({
    success: true,
    instances,
  });
}

// 检查实例可用性
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, id } = body;
    
    if (action === 'check' && id) {
      // 检查单个实例
      const instances = getSDInstances();
      const instance = instances.find(i => i.id === id);
      
      if (!instance) {
        return NextResponse.json(
          { error: '实例不存在' },
          { status: 404 }
        );
      }
      
      const isAvailable = await checkSDAvailability(instance.url);
      
      return NextResponse.json({
        success: true,
        id,
        isAvailable,
        url: instance.url,
      });
    }
    
    if (action === 'add') {
      // 添加新实例
      const { name, url, specialty, fixedModelFile, fixedModelName } = body;
      
      if (!name || !url) {
        return NextResponse.json(
          { error: '缺少名称或URL' },
          { status: 400 }
        );
      }
      
      const instances = addSDInstance(name, url);
      
      // 更新实例配置
      const instance = instances.find(i => i.name === name && i.url === url);
      if (instance) {
        if (specialty) instance.specialty = specialty;
        if (fixedModelFile) instance.fixedModelFile = fixedModelFile;
        if (fixedModelName) instance.fixedModelName = fixedModelName;
      }
      
      return NextResponse.json({
        success: true,
        instances,
      });
    }
    
    if (action === 'delete') {
      // 删除实例
      const { id } = body;
      
      if (!id) {
        return NextResponse.json(
          { error: '缺少实例ID' },
          { status: 400 }
        );
      }
      
      const instances = removeSDInstance(id);
      
      return NextResponse.json({
        success: true,
        instances,
      });
    }
    
    if (action === 'set-active') {
      // 设置优先实例
      const { id } = body;
      
      if (!id) {
        return NextResponse.json(
          { error: '缺少实例ID' },
          { status: 400 }
        );
      }
      
      const instances = setPreferredInstance(id);
      
      return NextResponse.json({
        success: true,
        instances,
      });
    }
    
    if (action === 'test-mode') {
      // 测试模式选择
      const { prompt, artStyle } = body;
      const result = await selectSDTarget(prompt, artStyle);
      
      return NextResponse.json({
        success: true,
        mode: result.mode,
        instance: result.instance ? {
          id: result.instance.id,
          name: result.instance.name,
          specialty: result.instance.specialty,
        } : null,
        model: result.model ? {
          id: result.model.id,
          name: result.model.name,
        } : null,
      });
    }
    
    // 检查所有实例
    const availableInstances = await getAvailableInstances();
    const instances = getSDInstances();
    const availableIds = new Set(availableInstances.map(i => i.id));
    
    return NextResponse.json({
      success: true,
      instances: instances.map(inst => ({
        ...inst,
        isAvailable: availableIds.has(inst.id),
      })),
      availableCount: availableInstances.length,
    });
  } catch (error) {
    console.error('检查实例错误:', error);
    return NextResponse.json(
      { error: '检查失败' },
      { status: 500 }
    );
  }
}

// 删除SD实例
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  
  if (!id) {
    return NextResponse.json(
      { error: '缺少实例ID' },
      { status: 400 }
    );
  }
  
  try {
    const instances = removeSDInstance(id);
    
    // 获取当前可用实例作为活跃实例
    const availableInstances = await getAvailableInstances();
    const activeInstanceId = availableInstances.length > 0 
      ? availableInstances[0].id 
      : (instances.length > 0 ? instances[0].id : '');
    
    return NextResponse.json({
      success: true,
      instances,
      activeInstanceId,
    });
  } catch (error) {
    console.error('删除实例错误:', error);
    return NextResponse.json(
      { error: '删除失败' },
      { status: 500 }
    );
  }
}
